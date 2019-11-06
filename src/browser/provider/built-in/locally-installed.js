import browserTools from 'testcafe-browser-tools';


export default {
    isMultiBrowser: true,

    async openBrowser (browserId, pageUrl, browserName) {
        console.log('locally installed open browser');
        const args  = browserName.split(' ');
        const alias = args.shift();

        const browserInfo    = await browserTools.getBrowserInfo(alias);

        console.log('q');

        const openParameters = Object.assign({}, browserInfo);

        if (args.length)
            openParameters.cmd = args.join(' ') + (openParameters.cmd ? ' ' + openParameters.cmd : '');

        await browserTools.open(openParameters, pageUrl);

        console.log('qq');
    },

    async isLocalBrowser () {
        return true;
    },

    async getBrowserList () {
        const installations = await browserTools.getInstallations();

        return Object.keys(installations);
    },

    async isValidBrowserName (browserName) {
        const browserNames = await this.getBrowserList();

        browserName = browserName.toLowerCase().split(' ')[0];

        return browserNames.indexOf(browserName) > -1;
    }
};
