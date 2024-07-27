import OptionsWidget from "../options_widget.js";

const TPL = `
<div class="options-section">
    <h4>Homepage</h4>
    
    Please fill in the note path that needs to be set as the homepage. This will make Trilium open this note automatically when opened.
    
    <div class="form-group">
        <input type="text" class="homepage-notePath form-control">
    </div>`;

export default class HomepageOptions extends OptionsWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$homepageNotePath = this.$widget.find(".homepage-notePath");
        this.$homepageNotePath.on('change', () =>
            this.updateOption('homepageNotePath', this.$homepageNotePath.val()));
    }

    async optionsLoaded(options) {
        this.$homepageNotePath.val(options.homepageNotePath);
    }
}
