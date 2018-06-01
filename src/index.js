import router from "./router.js";

import Layout from "./Layout.html";
import Home from "./Home.html";
import Page from "./Page.html";

router.addState({
    name     : "home",
    route    : "/",
    template : {
        component : Layout,
        options   : {
            Page : Home
        }
    }
});

router.addState({
    name     : "page",
    route    : "/page",
    template : {
        component : Layout,
        options   : {
            Page
        }
    }
});

router.evaluateCurrentRoute("home");
