import createRouter from "abstract-state-router";
import createRenderer from "svelte-state-renderer";
import sausage from "sausage-router";
import hashbrown from "hash-brown-router";

const renderer = createRenderer();
const router = createRouter(renderer, document.querySelector("body"), {
    pathPrefix  : "",
    router      : hashbrown(sausage())
});

export default router;
