import router from "./router.js";

import Home from "./Home.html";
import App from "./App.html";
import Page from "./Page.html";

router.addState({
    name         : "app",
    defaultChild : "home",
    route        : "/",
    template     : App
});

router.addState({
    name     : "app.home",
    route    : "/",
    template : Home
});

router.addState({
    name     : "app.page",
    route    : "/page",
    template : Page
});

router.evaluateCurrentRoute("app");
