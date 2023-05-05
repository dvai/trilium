"use strict";

const protectedSessionService = require('../../services/protected_session');
const utils = require('../../services/utils');
const log = require('../../services/log');
const noteService = require('../../services/notes');
const tmp = require('tmp');
const fs = require('fs');
const { Readable } = require('stream');
const chokidar = require('chokidar');
const ws = require('../../services/ws');
const becca = require("../../becca/becca");
const NotFoundError = require("../../errors/not_found_error");
const ValidationError = require("../../errors/validation_error.js");

function updateFile(req) {
    const note = becca.getNote(req.params.noteId);
    if (!note) {
        throw new NotFoundError(`Note '${req.params.noteId}' doesn't exist.`);
    }

    const file = req.file;
    note.saveNoteRevision();

    note.mime = file.mimetype.toLowerCase();
    note.save();

    note.setContent(file.buffer);

    note.setLabel('originalFileName', file.originalname);

    noteService.asyncPostProcessContent(note, file.buffer);

    return {
        uploaded: true
    };
}

function updateAttachment(req) {
    const attachment = becca.getAttachment(req.params.attachmentId);
    if (!attachment) {
        throw new NotFoundError(`Attachment '${req.params.attachmentId}' doesn't exist.`);
    }

    const file = req.file;
    attachment.getNote().saveNoteRevision();

    attachment.mime = file.mimetype.toLowerCase();
    attachment.setContent(file.buffer, {forceSave: true});

    return {
        uploaded: true
    };
}

/**
 * @param {BNote|BAttachment} noteOrAttachment
 * @param res
 * @param {boolean} contentDisposition
 */
function downloadData(noteOrAttachment, res, contentDisposition) {
    if (noteOrAttachment.isProtected && !protectedSessionService.isProtectedSessionAvailable()) {
        return res.status(401).send("Protected session not available");
    }

    if (contentDisposition) {
        const fileName = noteOrAttachment.getFileName();

        res.setHeader('Content-Disposition', utils.getContentDisposition(fileName));
    }

    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader('Content-Type', noteOrAttachment.mime);

    res.send(noteOrAttachment.getContent());
}

function downloadNoteInt(noteId, res, contentDisposition = true) {
    const note = becca.getNote(noteId);

    if (!note) {
        return res.setHeader("Content-Type", "text/plain")
            .status(404)
            .send(`Note '${noteId}' doesn't exist.`);
    }

    return downloadData(note, res, contentDisposition);
}

function downloadAttachmentInt(attachmentId, res, contentDisposition = true) {
    const attachment = becca.getAttachment(attachmentId);

    if (!attachment) {
        return res.setHeader("Content-Type", "text/plain")
            .status(404)
            .send(`Attachment '${attachmentId}' doesn't exist.`);
    }

    return downloadData(attachment, res, contentDisposition);
}

const downloadFile = (req, res) => downloadNoteInt(req.params.noteId, res, true);
const openFile = (req, res) => downloadNoteInt(req.params.noteId, res, false);

const downloadAttachment = (req, res) => downloadAttachmentInt(req.params.attachmentId, res, true);
const openAttachment = (req, res) => downloadAttachmentInt(req.params.attachmentId, res, false);

function fileContentProvider(req) {
    // Read the file name from route params.
    const note = becca.getNote(req.params.noteId);
    if (!note) {
        throw new NotFoundError(`Note '${req.params.noteId}' doesn't exist.`);
    }

    return streamContent(note.getContent(), note.getFileName(), note.mime);
}

function attachmentContentProvider(req) {
    // Read the file name from route params.
    const attachment = becca.getAttachment(req.params.attachmentId);
    if (!attachment) {
        throw new NotFoundError(`Attachment '${req.params.attachmentId}' doesn't exist.`);
    }

    return streamContent(attachment.getContent(), attachment.getFileName(), attachment.mime);
}

function streamContent(content, fileName, mimeType) {
    if (typeof content === "string") {
        content = Buffer.from(content, 'utf8');
    }

    const totalSize = content.byteLength;

    const getStream = range => {
        if (!range) {
            // Request if for complete content.
            return Readable.from(content);
        }
        // Partial content request.
        const {start, end} = range;

        return Readable.from(content.slice(start, end + 1));
    }

    return {
        fileName,
        totalSize,
        mimeType,
        getStream
    };
}

function saveNoteToTmpDir(req) {
    const note = becca.getNote(req.params.noteId);
    if (!note) {
        throw new NotFoundError(`Note '${req.params.noteId}' doesn't exist.`);
    }

    const fileName = note.getFileName();
    const content = note.getContent();

    return saveToTmpDir(fileName, content, 'notes', note.noteId);
}

function saveAttachmentToTmpDir(req) {
    const attachment = becca.getAttachment(req.params.attachmentId);
    if (!attachment) {
        throw new NotFoundError(`Attachment '${req.params.attachmentId}' doesn't exist.`);
    }

    const fileName = attachment.getFileName();
    const content = attachment.getContent();

    return saveToTmpDir(fileName, content, 'attachments', attachment.attachmentId);
}

function saveToTmpDir(fileName, content, entityType, entityId) {
    const tmpObj = tmp.fileSync({ postfix: fileName });

    fs.writeSync(tmpObj.fd, content);
    fs.closeSync(tmpObj.fd);

    log.info(`Saved temporary file ${tmpObj.name}`);

    if (utils.isElectron()) {
        chokidar.watch(tmpObj.name).on('change', (path, stats) => {
            ws.sendMessageToAllClients({
                type: 'openedFileUpdated',
                entityType: entityType,
                entityId: entityId,
                lastModifiedMs: stats.atimeMs,
                filePath: tmpObj.name
            });
        });
    }

    return {
        tmpFilePath: tmpObj.name
    };
}

function uploadModifiedFileToNote(req) {
    const noteId = req.params.noteId;
    const {filePath} = req.body;

    const note = becca.getNote(noteId);

    if (!note) {
        throw new NotFoundError(`Note '${noteId}' has not been found`);
    }

    log.info(`Updating note '${noteId}' with content from '${filePath}'`);

    note.saveNoteRevision();

    const fileContent = fs.readFileSync(filePath);

    if (!fileContent) {
        throw new ValidationError(`File '${fileContent}' is empty`);
    }

    note.setContent(fileContent);
}

function uploadModifiedFileToAttachment(req) {
    const {attachmentId} = req.params;
    const {filePath} = req.body;

    const attachment = becca.getAttachment(attachmentId);

    if (!attachment) {
        throw new NotFoundError(`Attachment '${attachmentId}' has not been found`);
    }

    log.info(`Updating attachment '${attachmentId}' with content from '${filePath}'`);

    attachment.getNote().saveNoteRevision();

    const fileContent = fs.readFileSync(filePath);

    if (!fileContent) {
        throw new ValidationError(`File '${fileContent}' is empty`);
    }

    attachment.setContent(fileContent);
}

module.exports = {
    updateFile,
    updateAttachment,
    openFile,
    fileContentProvider,
    downloadFile,
    downloadNoteInt,
    saveNoteToTmpDir,
    openAttachment,
    downloadAttachment,
    saveAttachmentToTmpDir,
    attachmentContentProvider,
    uploadModifiedFileToNote,
    uploadModifiedFileToAttachment
};
