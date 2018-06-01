module.exports = {
    input : "./src/index.js",

    output : {
        file   : "./dist/bundle.js",
        format : "iife",
        name   : "svelteRoutingTest",
        
        sourcemap : true,
    },

    plugins : [
        require("rollup-plugin-node-resolve")({ browser : true }),
        require("rollup-plugin-commonjs")(),
        require("rollup-plugin-svelte")(),

        require("rollup-plugin-livereload")(),
        require("rollup-plugin-serve")({
            contentBase        : ".",
            historyApiFallback : true,
        }),
    ]
};
