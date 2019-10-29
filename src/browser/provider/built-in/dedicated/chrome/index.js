import OS from 'os-family';
import { parse as parseUrl } from 'url';
import dedicatedProviderBase from '../base';
import getRuntimeInfo from './runtime-info';
import getConfig from './config';
import { start as startLocalChrome, stop as stopLocalChrome } from './local-chrome';
import * as cdp from './cdp';
import { GET_WINDOW_DIMENSIONS_INFO_SCRIPT } from '../../../utils/client-functions';


const MIN_AVAILABLE_DIMENSION = 50;

export default {
    ...dedicatedProviderBase,

    _getConfig (name) {
        return getConfig(name);
    },

    _getBrowserProtocolClient () {
        return cdp;
    },

    async openBrowser (browserId, pageUrl, configString, allowMultipleWindows) {
        console.log('chrome open browser: ' + pageUrl);
        const parsedPageUrl = parseUrl(pageUrl);
        const runtimeInfo   = await getRuntimeInfo(parsedPageUrl.hostname, configString, allowMultipleWindows);

        console.log('1');

        runtimeInfo.browserName = this._getBrowserName();
        runtimeInfo.browserId   = browserId;

        runtimeInfo.providerMethods = {
            resizeLocalBrowserWindow: (...args) => this.resizeLocalBrowserWindow(...args)
        };

        await startLocalChrome(pageUrl, runtimeInfo);

        console.log('2');

        await this.waitForConnectionReady(browserId);

        console.log('3');

        runtimeInfo.viewportSize = await this.runInitScript(browserId, GET_WINDOW_DIMENSIONS_INFO_SCRIPT);

        await cdp.createClient(runtimeInfo);

        console.log('4');

        this.openedBrowsers[browserId] = runtimeInfo;

        await this._ensureWindowIsExpanded(browserId, runtimeInfo.viewportSize);

        console.log('5');
    },

    async closeBrowser (browserId) {
        const runtimeInfo = this.openedBrowsers[browserId];

        if (cdp.isHeadlessTab(runtimeInfo))
            await cdp.closeTab(runtimeInfo);
        else
            await this.closeLocalBrowser(browserId);

        if (OS.mac || runtimeInfo.config.headless)
            await stopLocalChrome(runtimeInfo);

        if (runtimeInfo.tempProfileDir)
            await runtimeInfo.tempProfileDir.dispose();

        delete this.openedBrowsers[browserId];
    },

    async resizeWindow (browserId, width, height, currentWidth, currentHeight) {
        const runtimeInfo = this.openedBrowsers[browserId];

        if (runtimeInfo.config.mobile)
            await cdp.updateMobileViewportSize(runtimeInfo);
        else {
            runtimeInfo.viewportSize.width  = currentWidth;
            runtimeInfo.viewportSize.height = currentHeight;
        }

        await cdp.resizeWindow({ width, height }, runtimeInfo);
    },

    async getVideoFrameData (browserId) {
        return await cdp.getScreenshotData(this.openedBrowsers[browserId]);
    },

    async hasCustomActionForBrowser (browserId) {
        const { config, client } = this.openedBrowsers[browserId];

        return {
            hasCloseBrowser:                true,
            hasResizeWindow:                !!client && (config.emulation || config.headless),
            hasMaximizeWindow:              !!client && config.headless,
            hasTakeScreenshot:              !!client,
            hasChromelessScreenshots:       !!client,
            hasGetVideoFrameData:           !!client,
            hasCanResizeWindowToDimensions: false
        };
    },

    async _ensureWindowIsExpanded (browserId, { height, width, availableHeight, availableWidth, outerWidth, outerHeight }) {
        if (height < MIN_AVAILABLE_DIMENSION || width < MIN_AVAILABLE_DIMENSION) {
            const newHeight = Math.max(availableHeight, MIN_AVAILABLE_DIMENSION);
            const newWidth  = Math.max(Math.floor(availableWidth / 2), MIN_AVAILABLE_DIMENSION);

            await this.resizeWindow(browserId, newWidth, newHeight, outerWidth, outerHeight);
        }
    }
};
