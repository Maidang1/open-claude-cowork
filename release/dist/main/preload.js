(() => {
"use strict";
var __webpack_modules__ = ({
"electron"(module) {
module.exports = require("electron");

},

});
// The module cache
var __webpack_module_cache__ = {};

// The require function
function __webpack_require__(moduleId) {

// Check if module is in cache
var cachedModule = __webpack_module_cache__[moduleId];
if (cachedModule !== undefined) {
return cachedModule.exports;
}
// Create a new module (and put it into the cache)
var module = (__webpack_module_cache__[moduleId] = {
exports: {}
});
// Execute the module function
__webpack_modules__[moduleId](module, module.exports, __webpack_require__);

// Return the exports of the module
return module.exports;

}

// webpack/runtime/compat_get_default_export
(() => {
// getDefaultExport function for compatibility with non-ESM modules
__webpack_require__.n = (module) => {
	var getter = module && module.__esModule ?
		() => (module['default']) :
		() => (module);
	__webpack_require__.d(getter, { a: getter });
	return getter;
};

})();
// webpack/runtime/define_property_getters
(() => {
__webpack_require__.d = (exports, definition) => {
	for(var key in definition) {
        if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
            Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
        }
    }
};
})();
// webpack/runtime/has_own_property
(() => {
__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
})();
// webpack/runtime/make_namespace_object
(() => {
// define __esModule on exports
__webpack_require__.r = (exports) => {
	if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
	}
	Object.defineProperty(exports, '__esModule', { value: true });
};
})();
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
__webpack_require__.r(__webpack_exports__);
/* import */ var electron__rspack_import_0 = __webpack_require__("electron");
/* import */ var electron__rspack_import_0_default = /*#__PURE__*/__webpack_require__.n(electron__rspack_import_0);

const versions = process.versions;
electron__rspack_import_0.contextBridge.exposeInMainWorld("electron", {
    send: (channel, ...args)=>{
        electron__rspack_import_0.ipcRenderer.send(channel, ...args);
    },
    invoke: (channel, ...args)=>{
        return electron__rspack_import_0.ipcRenderer.invoke(channel, ...args);
    },
    on: (channel, listener)=>{
        const subscription = (_event, ...args)=>listener(...args);
        electron__rspack_import_0.ipcRenderer.on(channel, subscription);
        // Return a cleanup function
        return ()=>{
            electron__rspack_import_0.ipcRenderer.removeListener(channel, subscription);
        };
    },
    version: {
        electron: versions.electron,
        chrome: versions.chrome,
        node: versions.node
    }
});

})();

module.exports = __webpack_exports__;
})()
;
//# sourceMappingURL=preload.js.map