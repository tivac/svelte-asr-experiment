import shouldClick from "click-should-be-intercepted-for-navigation";
import router from "./router.js";

function process(args) {
    if(typeof args === "undefined") {
        throw new Error("Must pass args to link action");
    }

    if(typeof args === "string") {
        return [ args ];
    }

    return [ args.name, args.params, args.options ];
}

const link = (node, args) => {
    let state = process(args);
    
    const handler = (e) => {
        if(!shouldClick(e)) {
            return;
        }

        e.preventDefault();

        router.go(...state);
    };

    node.addEventListener("click", handler);
    node.href = router.makePath(...state);

    return {
        update(args) {
            state = process(args);
            node.href = router.makePath(...state);
        },
        
        destroy() {
            node.removeEventListener("click", handler);
        }
    };
};

export default link;
