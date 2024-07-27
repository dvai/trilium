
import RightPanelWidget from "./right_panel_widget.js";
import options from "../services/options.js";
import appContext from "../components/app_context.js";

export default class HomepageWidget extends RightPanelWidget {
    async doRenderBody() {
        this.isFirstTimeOpen = true;
    }
    isEnabled() {
        return super.isEnabled()
            && this.isFirstTimeOpen;
    }
    async refresh() {

        if (this.isEnabled()) {
            this.isFirstTimeOpen = false
            $(document).ready(async function () {
                const targetNotePath = options.get('homepageNotePath');
                const activeNoteContexts = appContext.tabManager.mainNoteContexts;
                console.log(activeNoteContexts)
                const matchingNoteContext = activeNoteContexts.find(nc => nc.noteId === targetNotePath.split("/").slice(-1)[0]);
                if (matchingNoteContext) {
                    console.log(1)
                    appContext.tabManager.activateNoteContext(matchingNoteContext.ntxId);
                }
                else {
                    console.log(2)
                    const result = await appContext.tabManager.openTabWithNoteWithHoisting(targetNotePath);
                    appContext.tabManager.activateNoteContext(result.ntxId)
                }
            })
        }
    }
}
