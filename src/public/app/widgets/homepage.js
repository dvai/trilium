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
                //增加延迟，如果去掉会有问题，暂未找到原因
                setTimeout(async () => {
                    const targetNotePath = options.get('homepageNotePath');
                    const activeNoteContexts = appContext.tabManager.mainNoteContexts;
                    const matchingNoteContext = activeNoteContexts.find(nc => nc.noteId === targetNotePath.split("/").slice(-1)[0]);
                    if (matchingNoteContext) {
                        appContext.tabManager.activateNoteContext(matchingNoteContext.ntxId);
                    }
                    else {
                        const result = await appContext.tabManager.openTabWithNoteWithHoisting(targetNotePath);
                        appContext.tabManager.activateNoteContext(result.ntxId)
                    }
                }, 500);
            })
        }
    }
}
