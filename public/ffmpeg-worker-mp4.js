var aconv = (function () {
    var _scriptDir = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : undefined;
    return (
        function (aconv) {
            aconv = aconv || {};

            var Module = typeof aconv !== "undefined" ? aconv : {};
            var __ffmpegjs_return;

            function __ffmpegjs_toU8(data) {
                if (Array.isArray(data) || data instanceof ArrayBuffer) {
                    data = new Uint8Array(data)
                } else if (!data) {
                    data = new Uint8Array(0)
                } else if (!(data instanceof Uint8Array)) {
                    data = new Uint8Array(data.buffer)
                }
                return data
            }

            Module["preRun"] = function () {
                console.log("preRun called! Module.arguments = ", Module.arguments);
                (Module["mounts"] || []).forEach(function (mount) {
                    var fs = FS.filesystems[mount["type"]];
                    if (!fs) {
                        throw new Error("Bad mount type")
                    }
                    var mountpoint = mount["mountpoint"];
                    if (!mountpoint.match(/^\/[^\/]+$/) || mountpoint === "/." || mountpoint === "/.." || mountpoint === "/tmp" || mountpoint === "/home" || mountpoint === "/dev" || mountpoint === "/work") {
                        throw new Error("Bad mount point")
                    }
                    FS.mkdir(mountpoint);
                    FS.mount(fs, mount["opts"], mountpoint)
                });
                FS.mkdir("/work");
                FS.chdir("/work");
                (Module["MEMFS"] || []).forEach(function (file) {
                    if (file["name"].match(/\//)) {
                        throw new Error("Bad file name")
                    }
                    var fd = FS.open(file["name"], "w+");
                    var data = __ffmpegjs_toU8(file["data"]);
                    FS.write(fd, data, 0, data.length);
                    FS.close(fd)
                })
            };
            Module["postRun"] = function () {
                console.log("postRun called! Module.arguments = ", Module.arguments);

                function listFiles(dir) {
                    var contents = FS.lookupPath(dir).node.contents;
                    var filenames = Object.keys(contents);
                    if (contents.__proto__ && contents.__proto__.name === "__proto__") {
                        filenames.push("__proto__")
                    }
                    return filenames.map(function (filename) {
                        return contents[filename]
                    })
                }

                var inFiles = Object.create(null);
                (Module["MEMFS"] || []).forEach(function (file) {
                    inFiles[file.name] = null
                });
                var outFiles = listFiles("/work").filter(function (file) {
                    return !(file.name in inFiles)
                }).map(function (file) {
                    var data = __ffmpegjs_toU8(file.contents);
                    return {"name": file.name, "data": data}
                });
                __ffmpegjs_return = {"MEMFS": outFiles};
                if (Module["postRunCallback"]) {
                    Module["postRunCallback"](__ffmpegjs_return)
                }
                if (Module["returnCallback"]) Module["returnCallback"](__ffmpegjs_return)
            };
            var moduleOverrides = {};
            var key;
            for (key in Module) {
                if (Module.hasOwnProperty(key)) {
                    moduleOverrides[key] = Module[key]
                }
            }
            Module["arguments"] = [];
            Module["thisProgram"] = "./this.program";
            Module["quit"] = function (status, toThrow) {
                throw toThrow
            };
            Module["preRun"] = [];
            Module["postRun"] = [];
            var ENVIRONMENT_IS_WEB = false;
            var ENVIRONMENT_IS_WORKER = false;
            var ENVIRONMENT_IS_NODE = false;
            var ENVIRONMENT_IS_SHELL = false;
            ENVIRONMENT_IS_WEB = typeof window === "object";
            ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
            ENVIRONMENT_IS_NODE = typeof process === "object" && typeof require === "function" && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
            ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
            var scriptDirectory = "";

            function locateFile(path) {
                if (Module["locateFile"]) {
                    return Module["locateFile"](path, scriptDirectory)
                } else {
                    return scriptDirectory + path
                }
            }

            if (ENVIRONMENT_IS_NODE) {
                scriptDirectory = __dirname + "/";
                var nodeFS;
                var nodePath;
                Module["read"] = function shell_read(filename, binary) {
                    var ret;
                    if (!nodeFS) nodeFS = require("fs");
                    if (!nodePath) nodePath = require("path");
                    filename = nodePath["normalize"](filename);
                    ret = nodeFS["readFileSync"](filename);
                    return binary ? ret : ret.toString()
                };
                Module["readBinary"] = function readBinary(filename) {
                    var ret = Module["read"](filename, true);
                    if (!ret.buffer) {
                        ret = new Uint8Array(ret)
                    }
                    assert(ret.buffer);
                    return ret
                };
                if (process["argv"].length > 1) {
                    Module["thisProgram"] = process["argv"][1].replace(/\\/g, "/")
                }
                Module["arguments"] = process["argv"].slice(2);
                process["on"]("uncaughtException", function (ex) {
                    if (!(ex instanceof ExitStatus)) {
                        throw ex
                    }
                });
                process["on"]("unhandledRejection", abort);
                Module["quit"] = function (status) {
                    process["exit"](status)
                };
                Module["inspect"] = function () {
                    return "[Emscripten Module object]"
                }
            } else if (ENVIRONMENT_IS_SHELL) {
                if (typeof read != "undefined") {
                    Module["read"] = function shell_read(f) {
                        return read(f)
                    }
                }
                Module["readBinary"] = function readBinary(f) {
                    var data;
                    if (typeof readbuffer === "function") {
                        return new Uint8Array(readbuffer(f))
                    }
                    data = read(f, "binary");
                    assert(typeof data === "object");
                    return data
                };
                if (typeof scriptArgs != "undefined") {
                    Module["arguments"] = scriptArgs
                } else if (typeof arguments != "undefined") {
                    Module["arguments"] = arguments
                }
                if (typeof quit === "function") {
                    Module["quit"] = function (status) {
                        quit(status)
                    }
                }
            } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
                if (ENVIRONMENT_IS_WORKER) {
                    scriptDirectory = self.location.href
                } else if (document.currentScript) {
                    scriptDirectory = document.currentScript.src
                }
                if (_scriptDir) {
                    scriptDirectory = _scriptDir
                }
                if (scriptDirectory.indexOf("blob:") !== 0) {
                    scriptDirectory = scriptDirectory.substr(0, scriptDirectory.lastIndexOf("/") + 1)
                } else {
                    scriptDirectory = ""
                }
                Module["read"] = function shell_read(url) {
                    var xhr = new XMLHttpRequest;
                    xhr.open("GET", url, false);
                    xhr.send(null);
                    return xhr.responseText
                };
                if (ENVIRONMENT_IS_WORKER) {
                    Module["readBinary"] = function readBinary(url) {
                        var xhr = new XMLHttpRequest;
                        xhr.open("GET", url, false);
                        xhr.responseType = "arraybuffer";
                        xhr.send(null);
                        return new Uint8Array(xhr.response)
                    }
                }
                Module["readAsync"] = function readAsync(url, onload, onerror) {
                    var xhr = new XMLHttpRequest;
                    xhr.open("GET", url, true);
                    xhr.responseType = "arraybuffer";
                    xhr.onload = function xhr_onload() {
                        if (xhr.status == 200 || xhr.status == 0 && xhr.response) {
                            onload(xhr.response);
                            return
                        }
                        onerror()
                    };
                    xhr.onerror = onerror;
                    xhr.send(null)
                };
                Module["setWindowTitle"] = function (title) {
                    document.title = title
                }
            } else {
            }
            var out = Module["print"] || (typeof console !== "undefined" ? console.log.bind(console) : typeof print !== "undefined" ? print : null);
            var err = Module["printErr"] || (typeof printErr !== "undefined" ? printErr : typeof console !== "undefined" && console.warn.bind(console) || out);
            for (key in moduleOverrides) {
                if (moduleOverrides.hasOwnProperty(key)) {
                    Module[key] = moduleOverrides[key]
                }
            }
            moduleOverrides = undefined;
            var STACK_ALIGN = 16;

            function dynamicAlloc(size) {
                var ret = HEAP32[DYNAMICTOP_PTR >> 2];
                var end = ret + size + 15 & -16;
                if (end <= _emscripten_get_heap_size()) {
                    HEAP32[DYNAMICTOP_PTR >> 2] = end
                } else {
                    var success = _emscripten_resize_heap(end);
                    if (!success) return 0
                }
                return ret
            }

            function getNativeTypeSize(type) {
                switch (type) {
                    case"i1":
                    case"i8":
                        return 1;
                    case"i16":
                        return 2;
                    case"i32":
                        return 4;
                    case"i64":
                        return 8;
                    case"float":
                        return 4;
                    case"double":
                        return 8;
                    default: {
                        if (type[type.length - 1] === "*") {
                            return 4
                        } else if (type[0] === "i") {
                            var bits = parseInt(type.substr(1));
                            assert(bits % 8 === 0, "getNativeTypeSize invalid bits " + bits + ", type " + type);
                            return bits / 8
                        } else {
                            return 0
                        }
                    }
                }
            }

            function warnOnce(text) {
                if (!warnOnce.shown) warnOnce.shown = {};
                if (!warnOnce.shown[text]) {
                    warnOnce.shown[text] = 1;
                    err(text)
                }
            }

            var asm2wasmImports = {
                "f64-rem": function (x, y) {
                    return x % y
                }, "debugger": function () {
                    debugger
                }
            };
            var jsCallStartIndex = 1;
            var functionPointers = new Array(0);

            function convertJsFunctionToWasm(func, sig) {
                var typeSection = [1, 0, 1, 96];
                var sigRet = sig.slice(0, 1);
                var sigParam = sig.slice(1);
                var typeCodes = {"i": 127, "j": 126, "f": 125, "d": 124};
                typeSection.push(sigParam.length);
                for (var i = 0; i < sigParam.length; ++i) {
                    typeSection.push(typeCodes[sigParam[i]])
                }
                if (sigRet == "v") {
                    typeSection.push(0)
                } else {
                    typeSection = typeSection.concat([1, typeCodes[sigRet]])
                }
                typeSection[1] = typeSection.length - 2;
                var bytes = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0].concat(typeSection, [2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0]));
                var module = new WebAssembly.Module(bytes);
                var instance = new WebAssembly.Instance(module, {e: {f: func}});
                var wrappedFunc = instance.exports.f;
                return wrappedFunc
            }

            var funcWrappers = {};

            function dynCall(sig, ptr, args) {
                if (args && args.length) {
                    return Module["dynCall_" + sig].apply(null, [ptr].concat(args))
                } else {
                    return Module["dynCall_" + sig].call(null, ptr)
                }
            }

            var tempRet0 = 0;
            var setTempRet0 = function (value) {
                tempRet0 = value
            };
            var getTempRet0 = function () {
                return tempRet0
            };
            if (typeof WebAssembly !== "object") {
                err("no native wasm support detected")
            }
            var wasmMemory;
            var wasmTable;
            var ABORT = false;
            var EXITSTATUS = 0;

            function assert(condition, text) {
                if (!condition) {
                    abort("Assertion failed: " + text)
                }
            }

            function getCFunc(ident) {
                var func = Module["_" + ident];
                assert(func, "Cannot call unknown function " + ident + ", make sure it is exported");
                return func
            }

            function ccall(ident, returnType, argTypes, args, opts) {
                var toC = {
                    "string": function (str) {
                        var ret = 0;
                        if (str !== null && str !== undefined && str !== 0) {
                            var len = (str.length << 2) + 1;
                            ret = stackAlloc(len);
                            stringToUTF8(str, ret, len)
                        }
                        return ret
                    }, "array": function (arr) {
                        var ret = stackAlloc(arr.length);
                        writeArrayToMemory(arr, ret);
                        return ret
                    }
                };

                function convertReturnValue(ret) {
                    if (returnType === "string") return UTF8ToString(ret);
                    if (returnType === "boolean") return Boolean(ret);
                    return ret
                }

                var func = getCFunc(ident);
                var cArgs = [];
                var stack = 0;
                if (args) {
                    for (var i = 0; i < args.length; i++) {
                        var converter = toC[argTypes[i]];
                        if (converter) {
                            if (stack === 0) stack = stackSave();
                            cArgs[i] = converter(args[i])
                        } else {
                            cArgs[i] = args[i]
                        }
                    }
                }
                var ret = func.apply(null, cArgs);
                if (typeof EmterpreterAsync === "object" && EmterpreterAsync.state) {
                    return new Promise(function (resolve) {
                        EmterpreterAsync.restartFunc = func;
                        EmterpreterAsync.asyncFinalizers.push(function (ret) {
                            if (stack !== 0) stackRestore(stack);
                            resolve(convertReturnValue(ret))
                        })
                    })
                }
                ret = convertReturnValue(ret);
                if (stack !== 0) stackRestore(stack);
                if (opts && opts.async) return Promise.resolve(ret);
                return ret
            }

            function setValue(ptr, value, type, noSafe) {
                type = type || "i8";
                if (type.charAt(type.length - 1) === "*") type = "i32";
                switch (type) {
                    case"i1":
                        HEAP8[ptr >> 0] = value;
                        break;
                    case"i8":
                        HEAP8[ptr >> 0] = value;
                        break;
                    case"i16":
                        HEAP16[ptr >> 1] = value;
                        break;
                    case"i32":
                        HEAP32[ptr >> 2] = value;
                        break;
                    case"i64":
                        tempI64 = [value >>> 0, (tempDouble = value, +Math_abs(tempDouble) >= +1 ? tempDouble > +0 ? (Math_min(+Math_floor(tempDouble / +4294967296), +4294967295) | 0) >>> 0 : ~~+Math_ceil((tempDouble - +(~~tempDouble >>> 0)) / +4294967296) >>> 0 : 0)], HEAP32[ptr >> 2] = tempI64[0], HEAP32[ptr + 4 >> 2] = tempI64[1];
                        break;
                    case"float":
                        HEAPF32[ptr >> 2] = value;
                        break;
                    case"double":
                        HEAPF64[ptr >> 3] = value;
                        break;
                    default:
                        abort("invalid type for setValue: " + type)
                }
            }

            var ALLOC_NORMAL = 0;
            var ALLOC_NONE = 3;

            function allocate(slab, types, allocator, ptr) {
                var zeroinit, size;
                if (typeof slab === "number") {
                    zeroinit = true;
                    size = slab
                } else {
                    zeroinit = false;
                    size = slab.length
                }
                var singleType = typeof types === "string" ? types : null;
                var ret;
                if (allocator == ALLOC_NONE) {
                    ret = ptr
                } else {
                    ret = [_malloc, stackAlloc, dynamicAlloc][allocator](Math.max(size, singleType ? 1 : types.length))
                }
                if (zeroinit) {
                    var stop;
                    ptr = ret;
                    assert((ret & 3) == 0);
                    stop = ret + (size & ~3);
                    for (; ptr < stop; ptr += 4) {
                        HEAP32[ptr >> 2] = 0
                    }
                    stop = ret + size;
                    while (ptr < stop) {
                        HEAP8[ptr++ >> 0] = 0
                    }
                    return ret
                }
                if (singleType === "i8") {
                    if (slab.subarray || slab.slice) {
                        HEAPU8.set(slab, ret)
                    } else {
                        HEAPU8.set(new Uint8Array(slab), ret)
                    }
                    return ret
                }
                var i = 0, type, typeSize, previousType;
                while (i < size) {
                    var curr = slab[i];
                    type = singleType || types[i];
                    if (type === 0) {
                        i++;
                        continue
                    }
                    if (type == "i64") type = "i32";
                    setValue(ret + i, curr, type);
                    if (previousType !== type) {
                        typeSize = getNativeTypeSize(type);
                        previousType = type
                    }
                    i += typeSize
                }
                return ret
            }

            function getMemory(size) {
                if (!runtimeInitialized) return dynamicAlloc(size);
                return _malloc(size)
            }

            var UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;

            function UTF8ArrayToString(u8Array, idx, maxBytesToRead) {
                var endIdx = idx + maxBytesToRead;
                var endPtr = idx;
                while (u8Array[endPtr] && !(endPtr >= endIdx)) ++endPtr;
                if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
                    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr))
                } else {
                    var str = "";
                    while (idx < endPtr) {
                        var u0 = u8Array[idx++];
                        if (!(u0 & 128)) {
                            str += String.fromCharCode(u0);
                            continue
                        }
                        var u1 = u8Array[idx++] & 63;
                        if ((u0 & 224) == 192) {
                            str += String.fromCharCode((u0 & 31) << 6 | u1);
                            continue
                        }
                        var u2 = u8Array[idx++] & 63;
                        if ((u0 & 240) == 224) {
                            u0 = (u0 & 15) << 12 | u1 << 6 | u2
                        } else {
                            u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | u8Array[idx++] & 63
                        }
                        if (u0 < 65536) {
                            str += String.fromCharCode(u0)
                        } else {
                            var ch = u0 - 65536;
                            str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
                        }
                    }
                }
                return str
            }

            function UTF8ToString(ptr, maxBytesToRead) {
                return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : ""
            }

            function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
                if (!(maxBytesToWrite > 0)) return 0;
                var startIdx = outIdx;
                var endIdx = outIdx + maxBytesToWrite - 1;
                for (var i = 0; i < str.length; ++i) {
                    var u = str.charCodeAt(i);
                    if (u >= 55296 && u <= 57343) {
                        var u1 = str.charCodeAt(++i);
                        u = 65536 + ((u & 1023) << 10) | u1 & 1023
                    }
                    if (u <= 127) {
                        if (outIdx >= endIdx) break;
                        outU8Array[outIdx++] = u
                    } else if (u <= 2047) {
                        if (outIdx + 1 >= endIdx) break;
                        outU8Array[outIdx++] = 192 | u >> 6;
                        outU8Array[outIdx++] = 128 | u & 63
                    } else if (u <= 65535) {
                        if (outIdx + 2 >= endIdx) break;
                        outU8Array[outIdx++] = 224 | u >> 12;
                        outU8Array[outIdx++] = 128 | u >> 6 & 63;
                        outU8Array[outIdx++] = 128 | u & 63
                    } else {
                        if (outIdx + 3 >= endIdx) break;
                        outU8Array[outIdx++] = 240 | u >> 18;
                        outU8Array[outIdx++] = 128 | u >> 12 & 63;
                        outU8Array[outIdx++] = 128 | u >> 6 & 63;
                        outU8Array[outIdx++] = 128 | u & 63
                    }
                }
                outU8Array[outIdx] = 0;
                return outIdx - startIdx
            }

            function stringToUTF8(str, outPtr, maxBytesToWrite) {
                return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite)
            }

            function lengthBytesUTF8(str) {
                var len = 0;
                for (var i = 0; i < str.length; ++i) {
                    var u = str.charCodeAt(i);
                    if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
                    if (u <= 127) ++len; else if (u <= 2047) len += 2; else if (u <= 65535) len += 3; else len += 4
                }
                return len
            }

            var UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;

            function allocateUTF8(str) {
                var size = lengthBytesUTF8(str) + 1;
                var ret = _malloc(size);
                if (ret) stringToUTF8Array(str, HEAP8, ret, size);
                return ret
            }

            function allocateUTF8OnStack(str) {
                var size = lengthBytesUTF8(str) + 1;
                var ret = stackAlloc(size);
                stringToUTF8Array(str, HEAP8, ret, size);
                return ret
            }

            function writeArrayToMemory(array, buffer) {
                HEAP8.set(array, buffer)
            }

            function writeAsciiToMemory(str, buffer, dontAddNull) {
                for (var i = 0; i < str.length; ++i) {
                    HEAP8[buffer++ >> 0] = str.charCodeAt(i)
                }
                if (!dontAddNull) HEAP8[buffer >> 0] = 0
            }

            function demangle(func) {
                return func
            }

            function demangleAll(text) {
                var regex = /__Z[\w\d_]+/g;
                return text.replace(regex, function (x) {
                    var y = demangle(x);
                    return x === y ? x : y + " [" + x + "]"
                })
            }

            function jsStackTrace() {
                var err = new Error;
                if (!err.stack) {
                    try {
                        throw new Error(0)
                    } catch (e) {
                        err = e
                    }
                    if (!err.stack) {
                        return "(no stack trace available)"
                    }
                }
                return err.stack.toString()
            }

            function stackTrace() {
                var js = jsStackTrace();
                if (Module["extraStackTrace"]) js += "\n" + Module["extraStackTrace"]();
                return demangleAll(js)
            }

            var WASM_PAGE_SIZE = 65536;

            function alignUp(x, multiple) {
                if (x % multiple > 0) {
                    x += multiple - x % multiple
                }
                return x
            }

            var buffer, HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;

            function updateGlobalBufferViews() {
                Module["HEAP8"] = HEAP8 = new Int8Array(buffer);
                Module["HEAP16"] = HEAP16 = new Int16Array(buffer);
                Module["HEAP32"] = HEAP32 = new Int32Array(buffer);
                Module["HEAPU8"] = HEAPU8 = new Uint8Array(buffer);
                Module["HEAPU16"] = HEAPU16 = new Uint16Array(buffer);
                Module["HEAPU32"] = HEAPU32 = new Uint32Array(buffer);
                Module["HEAPF32"] = HEAPF32 = new Float32Array(buffer);
                Module["HEAPF64"] = HEAPF64 = new Float64Array(buffer)
            }

            var STACK_BASE = 4310512, DYNAMIC_BASE = 9553392, DYNAMICTOP_PTR = 4310256;

            function abortStackOverflowEmterpreter() {
                abort("Emterpreter stack overflow! Decrease the recursion level or increase EMT_STACK_MAX in tools/emterpretify.py (current value " + EMT_STACK_MAX + ").")
            }

            var TOTAL_STACK = 5242880;
            var INITIAL_TOTAL_MEMORY = Module["TOTAL_MEMORY"] || 149880832;
            if (INITIAL_TOTAL_MEMORY < TOTAL_STACK) err("TOTAL_MEMORY should be larger than TOTAL_STACK, was " + INITIAL_TOTAL_MEMORY + "! (TOTAL_STACK=" + TOTAL_STACK + ")");
            if (Module["buffer"]) {
                buffer = Module["buffer"]
            } else {
                if (typeof WebAssembly === "object" && typeof WebAssembly.Memory === "function") {
                    wasmMemory = new WebAssembly.Memory({"initial": INITIAL_TOTAL_MEMORY / WASM_PAGE_SIZE});
                    buffer = wasmMemory.buffer
                } else {
                    buffer = new ArrayBuffer(INITIAL_TOTAL_MEMORY)
                }
            }
            updateGlobalBufferViews();
            HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;

            function callRuntimeCallbacks(callbacks) {
                while (callbacks.length > 0) {
                    var callback = callbacks.shift();
                    if (typeof callback == "function") {
                        callback();
                        continue
                    }
                    var func = callback.func;
                    if (typeof func === "number") {
                        if (callback.arg === undefined) {
                            Module["dynCall_v"](func)
                        } else {
                            Module["dynCall_vi"](func, callback.arg)
                        }
                    } else {
                        func(callback.arg === undefined ? null : callback.arg)
                    }
                }
            }

            var __ATPRERUN__ = [];
            var __ATINIT__ = [];
            var __ATMAIN__ = [];
            var __ATEXIT__ = [];
            var __ATPOSTRUN__ = [];
            var runtimeInitialized = false;
            var runtimeExited = false;

            function preRun() {
                if (Module["preRun"]) {
                    if (typeof Module["preRun"] == "function") Module["preRun"] = [Module["preRun"]];
                    while (Module["preRun"].length) {
                        addOnPreRun(Module["preRun"].shift())
                    }
                }
                callRuntimeCallbacks(__ATPRERUN__)
            }

            function ensureInitRuntime() {
                if (runtimeInitialized) return;
                runtimeInitialized = true;
                if (!Module["noFSInit"] && !FS.init.initialized) FS.init();
                TTY.init();
                callRuntimeCallbacks(__ATINIT__)
            }

            function preMain() {
                FS.ignorePermissions = false;
                callRuntimeCallbacks(__ATMAIN__)
            }

            function exitRuntime() {
                callRuntimeCallbacks(__ATEXIT__);
                FS.quit();
                TTY.shutdown();
                runtimeExited = true
            }

            function postRun() {
                if (Module["postRun"]) {
                    if (typeof Module["postRun"] == "function") Module["postRun"] = [Module["postRun"]];
                    while (Module["postRun"].length) {
                        addOnPostRun(Module["postRun"].shift())
                    }
                }
                callRuntimeCallbacks(__ATPOSTRUN__)
            }

            function addOnPreRun(cb) {
                __ATPRERUN__.unshift(cb)
            }

            function addOnPostRun(cb) {
                __ATPOSTRUN__.unshift(cb)
            }

            var Math_abs = Math.abs;
            var Math_ceil = Math.ceil;
            var Math_floor = Math.floor;
            var Math_min = Math.min;
            var Math_clz32 = Math.clz32;
            var Math_trunc = Math.trunc;
            var runDependencies = 0;
            var runDependencyWatcher = null;
            var dependenciesFulfilled = null;

            function getUniqueRunDependency(id) {
                return id
            }

            function addRunDependency(id) {
                runDependencies++;
                if (Module["monitorRunDependencies"]) {
                    Module["monitorRunDependencies"](runDependencies)
                }
            }

            function removeRunDependency(id) {
                runDependencies--;
                if (Module["monitorRunDependencies"]) {
                    Module["monitorRunDependencies"](runDependencies)
                }
                if (runDependencies == 0) {
                    if (runDependencyWatcher !== null) {
                        clearInterval(runDependencyWatcher);
                        runDependencyWatcher = null
                    }
                    if (dependenciesFulfilled) {
                        var callback = dependenciesFulfilled;
                        dependenciesFulfilled = null;
                        callback()
                    }
                }
            }

            Module["preloadedImages"] = {};
            Module["preloadedAudios"] = {};
            var dataURIPrefix = "data:application/octet-stream;base64,";

            function isDataURI(filename) {
                return String.prototype.startsWith ? filename.startsWith(dataURIPrefix) : filename.indexOf(dataURIPrefix) === 0
            }

            var wasmBinaryFile = "ffmpeg-worker-mp4.wasm";
            if (!isDataURI(wasmBinaryFile)) {
                wasmBinaryFile = locateFile(wasmBinaryFile)
            }

            function getBinary() {
                try {
                    if (Module["wasmBinary"]) {
                        return new Uint8Array(Module["wasmBinary"])
                    }
                    if (Module["readBinary"]) {
                        return Module["readBinary"](wasmBinaryFile)
                    } else {
                        throw"both async and sync fetching of the wasm failed"
                    }
                } catch (err) {
                    abort(err)
                }
            }

            function getBinaryPromise() {
                if (!Module["wasmBinary"] && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && typeof fetch === "function") {
                    return fetch(wasmBinaryFile, {credentials: "same-origin"}).then(function (response) {
                        if (!response["ok"]) {
                            throw"failed to load wasm binary file at '" + wasmBinaryFile + "'"
                        }
                        return response["arrayBuffer"]()
                    }).catch(function () {
                        return getBinary()
                    })
                }
                return new Promise(function (resolve, reject) {
                    resolve(getBinary())
                })
            }

            function createWasm(env) {
                var info = {
                    "env": env,
                    "global": {"NaN": NaN, Infinity: Infinity},
                    "global.Math": Math,
                    "asm2wasm": asm2wasmImports
                };

                function receiveInstance(instance, module) {
                    var exports = instance.exports;
                    Module["asm"] = exports;
                    removeRunDependency("wasm-instantiate")
                }

                addRunDependency("wasm-instantiate");
                if (Module["instantiateWasm"]) {
                    try {
                        return Module["instantiateWasm"](info, receiveInstance)
                    } catch (e) {
                        err("Module.instantiateWasm callback failed with error: " + e);
                        return false
                    }
                }

                function receiveInstantiatedSource(output) {
                    receiveInstance(output["instance"])
                }

                function instantiateArrayBuffer(receiver) {
                    getBinaryPromise().then(function (binary) {
                        return WebAssembly.instantiate(binary, info)
                    }).then(receiver, function (reason) {
                        err("failed to asynchronously prepare wasm: " + reason);
                        abort(reason)
                    })
                }

                if (!Module["wasmBinary"] && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && typeof fetch === "function") {
                    WebAssembly.instantiateStreaming(fetch(wasmBinaryFile, {credentials: "same-origin"}), info).then(receiveInstantiatedSource, function (reason) {
                        err("wasm streaming compile failed: " + reason);
                        err("falling back to ArrayBuffer instantiation");
                        instantiateArrayBuffer(receiveInstantiatedSource)
                    })
                } else {
                    instantiateArrayBuffer(receiveInstantiatedSource)
                }
                return {}
            }

            Module["asm"] = function (global, env, providedBuffer) {
                env["memory"] = wasmMemory;
                env["table"] = wasmTable = new WebAssembly.Table({
                    "initial": 5045,
                    "maximum": 5045,
                    "element": "anyfunc"
                });
                env["__memory_base"] = 1024;
                env["__table_base"] = 0;
                var exports = createWasm(env);
                return exports
            };
            __ATINIT__.push({
                func: function () {
                    ___emscripten_environ_constructor()
                }
            });
            var tempDoublePtr = 4310496;
            var EMTSTACKTOP = getMemory(1048576);
            var EMT_STACK_MAX = EMTSTACKTOP + 1048576;
            var eb = getMemory(82744);
            __ATPRERUN__.push(function () {
                HEAPU8.set([140, 0, 128, 0, 0, 0, 0, 0, 2, 116, 0, 0, 136, 22, 0, 0, 2, 117, 0, 0, 0, 27, 0, 0, 2, 118, 0, 0, 64, 18, 0, 0, 2, 119, 0, 0, 64, 2, 0, 0, 1, 0, 0, 0, 136, 120, 0, 0, 0, 1, 120, 0, 136, 120, 0, 0, 1, 121, 144, 30, 3, 120, 120, 121, 137, 120, 0, 0, 3, 121, 1, 118, 1, 122, 0, 0, 1, 123, 0, 4, 135, 120, 0, 0, 121, 122, 123, 0, 2, 120, 0, 0, 4, 188, 65, 0, 82, 2, 120, 0, 1, 120, 0, 0, 47, 120, 120, 2, 188, 1, 0, 0, 2, 120, 0, 0, 0, 188, 65, 0, 82, 3, 120, 0, 2, 120, 0, 0, 220, 187, 65, 0, 82, 4, 120, 0, 2, 120, 0, 0, 216, 187, 65, 0, 82, 5, 120, 0, 36, 120, 4, 0, 121, 120, 29, 0, 1, 6, 0, 0, 41, 120, 6, 2, 94, 7, 3, 120, 106, 8, 7, 28, 1, 120, 0, 0, 47, 120, 120, 8, 252, 0, 0, 0, 106, 9, 7, 24, 1, 10, 0, 0, 41, 120, 10, 2, 94, 120, 9, 120, 106, 11, 120, 4, 121, 11, 9, 0, 106, 120, 11, 8, 36, 120, 120, 255, 121, 120, 6, 0, 106, 120, 7, 20, 32, 120, 120, 1, 121, 120, 3, 0, 26, 123, 4, 1, 109, 11, 8, 123, 25, 10, 10, 1, 53, 123, 10, 8, 192, 0, 0, 0, 25, 6, 6, 1, 52, 123, 6, 2, 188, 1, 0, 0, 119, 0, 230, 255, 1, 6, 0, 0, 41, 123, 6, 2, 94, 8, 3, 123, 106, 10, 8, 28, 1, 123, 0, 0, 47, 123, 123, 10, 176, 1, 0, 0, 106, 7, 8, 24, 1, 9, 0, 0, 41, 123, 9, 2, 94, 123, 7, 123, 106, 11, 123, 4, 121, 11, 26, 0, 106, 123, 11, 8, 36, 123, 123, 255, 121, 123, 23, 0, 106, 123, 8, 20, 32, 123, 123, 1, 121, 123, 20, 0, 106, 123, 8, 16, 82, 123, 123, 0, 106, 12, 123, 4, 26, 13, 4, 1, 41, 123, 13, 2, 94, 123, 5, 123, 45, 123, 12, 123, 128, 1, 0, 0, 0, 14, 13, 0, 119, 0, 9, 0, 26, 15, 13, 1, 1, 123, 0, 0, 47, 123, 123, 13, 152, 1, 0, 0, 0, 13, 15, 0, 119, 0, 245, 255, 0, 14, 15, 0, 119, 0, 1, 0, 109, 11, 8, 14, 25, 9, 9, 1, 53, 123, 9, 10, 48, 1, 0, 0, 25, 6, 6, 1, 53, 123, 6, 2, 16, 1, 0, 0, 2, 123, 0, 0, 228, 187, 65, 0, 82, 2, 123, 0, 1, 123, 0, 0, 47, 123, 123, 2, 124, 2, 0, 0, 1, 14, 0, 0, 0, 6, 2, 0, 2, 123, 0, 0, 224, 187, 65, 0, 82, 123, 123, 0, 41, 120, 14, 2, 94, 2, 123, 120, 106, 123, 2, 96, 120, 123, 3, 0, 0, 16, 6, 0, 119, 0, 27, 0, 1, 123, 0, 0, 106, 120, 2, 88, 47, 123, 123, 120, 100, 2, 0, 0, 1, 5, 0, 0, 135, 4, 1, 0, 135, 3, 2, 0, 2, 123, 0, 0, 216, 187, 65, 0, 82, 123, 123, 0, 106, 120, 2, 12, 3, 120, 120, 5, 41, 120, 120, 2, 94, 123, 123, 120, 25, 10, 123, 40, 85, 10, 4, 0, 109, 10, 4, 3, 25, 5, 5, 1, 106, 123, 2, 88, 54, 123, 5, 123, 20, 2, 0, 0, 2, 123, 0, 0, 228, 187, 65, 0, 82, 16, 123, 0, 119, 0, 2, 0, 0, 16, 6, 0, 25, 14, 14, 1, 56, 123, 16, 14, 124, 2, 0, 0, 0, 6, 16, 0, 119, 0, 217, 255, 2, 123, 0, 0, 220, 187, 65, 0, 82, 16, 123, 0, 1, 123, 0, 0, 47, 123, 123, 16, 80, 7, 0, 0, 1, 6, 0, 0, 0, 14, 16, 0, 2, 123, 0, 0, 216, 187, 65, 0, 82, 123, 123, 0, 41, 120, 6, 2, 94, 17, 123, 120, 106, 123, 17, 16, 120, 123, 3, 0, 0, 18, 14, 0, 119, 0, 130, 0, 106, 2, 17, 24, 106, 19, 17, 20, 120, 2, 3, 0, 1, 0, 36, 0, 119, 0, 144, 0, 109, 19, 32, 17, 1, 120, 84, 0, 109, 19, 120, 120, 1, 120, 144, 1, 1, 123, 149, 0, 97, 19, 120, 123, 1, 123, 188, 2, 1, 120, 1, 0, 97, 19, 123, 120, 2, 123, 0, 0, 25, 63, 12, 0, 1, 122, 1, 0, 1, 121, 0, 0, 1, 124, 0, 0, 135, 120, 3, 0, 19, 123, 122, 121, 124, 0, 0, 0, 106, 120, 17, 20, 106, 120, 120, 16, 2, 124, 0, 0, 1, 112, 1, 0, 45, 120, 120, 124, 140, 3, 0, 0, 106, 120, 17, 16, 38, 120, 120, 1, 121, 120, 21, 0, 1, 124, 140, 0, 3, 124, 17, 124, 2, 121, 0, 0, 60, 94, 10, 0, 2, 122, 0, 0, 65, 62, 13, 0, 1, 123, 16, 0, 135, 120, 4, 0, 124, 121, 122, 123, 106, 120, 17, 16, 38, 120, 120, 2, 121, 120, 9, 0, 1, 123, 0, 0, 1, 122, 24, 0, 2, 121, 0, 0, 72, 94, 10, 0, 1, 124, 24, 23, 3, 124, 1, 124, 135, 120, 5, 0, 123, 122, 121, 124, 1, 124, 140, 0, 3, 124, 17, 124, 2, 121, 0, 0, 211, 62, 12, 0, 2, 122, 0, 0, 4, 63, 12, 0, 1, 123, 16, 0, 135, 120, 4, 0, 124, 121, 122, 123, 106, 120, 17, 4, 25, 5, 120, 16, 106, 3, 5, 4, 106, 120, 17, 20, 1, 123, 4, 3, 3, 10, 120, 123, 116, 10, 5, 0, 109, 10, 4, 3, 1, 120, 140, 0, 94, 120, 17, 120, 2, 122, 0, 0, 153, 55, 13, 0, 1, 121, 0, 0, 1, 124, 0, 0, 135, 123, 6, 0, 120, 122, 121, 124, 120, 123, 10, 0, 1, 124, 140, 0, 3, 124, 17, 124, 2, 121, 0, 0, 153, 55, 13, 0, 2, 122, 0, 0, 148, 55, 13, 0, 1, 120, 0, 0, 135, 123, 4, 0, 124, 121, 122, 120, 106, 123, 17, 4, 106, 123, 123, 48, 1, 120, 0, 4, 19, 123, 123, 120, 121, 123, 10, 0, 1, 120, 140, 0, 3, 120, 17, 120, 2, 122, 0, 0, 153, 55, 13, 0, 2, 121, 0, 0, 65, 62, 13, 0, 1, 124, 0, 0, 135, 123, 4, 0, 120, 122, 121, 124, 135, 20, 7, 0, 17, 0, 0, 0, 34, 123, 20, 0, 121, 123, 3, 0, 1, 0, 46, 0, 119, 0, 43, 0, 106, 123, 17, 20, 1, 124, 140, 0, 3, 124, 17, 124, 135, 21, 8, 0, 123, 2, 124, 0, 34, 124, 21, 0, 121, 124, 3, 0, 1, 0, 48, 0, 119, 0, 34, 0, 1, 124, 140, 0, 94, 124, 17, 124, 2, 123, 0, 0, 218, 192, 65, 0, 1, 121, 0, 0, 1, 122, 2, 0, 135, 22, 6, 0, 124, 123, 121, 122, 121, 22, 3, 0, 1, 0, 53, 0, 119, 0, 23, 0, 2, 122, 0, 0, 220, 187, 65, 0, 82, 18, 122, 0, 1, 121, 0, 0, 109, 17, 64, 121, 25, 121, 17, 64, 2, 122, 0, 0, 0, 0, 0, 128, 109, 121, 4, 122, 1, 121, 0, 0, 109, 17, 48, 121, 25, 121, 17, 48, 2, 122, 0, 0, 0, 0, 0, 128, 109, 121, 4, 122, 25, 6, 6, 1, 49, 122, 18, 6, 8, 5, 0, 0, 1, 0, 58, 0, 119, 0, 148, 0, 0, 14, 18, 0, 119, 0, 100, 255, 32, 122, 0, 36, 121, 122, 25, 0, 106, 122, 19, 16, 135, 14, 9, 0, 122, 0, 0, 0, 82, 6, 17, 0, 106, 122, 17, 4, 82, 2, 122, 0, 1, 122, 8, 23, 97, 1, 122, 14, 1, 122, 8, 23, 3, 122, 1, 122, 109, 122, 4, 6, 1, 122, 8, 23, 3, 122, 1, 122, 109, 122, 8, 2, 3, 121, 1, 118, 1, 123, 0, 4, 2, 124, 0, 0, 7, 94, 10, 0, 1, 120, 8, 23, 3, 120, 1, 120, 135, 122, 10, 0, 121, 123, 124, 120, 1, 23, 234, 255, 119, 0, 94, 0, 32, 122, 0, 46, 121, 122, 32, 0, 82, 2, 17, 0, 106, 122, 17, 4, 82, 6, 122, 0, 0, 24, 1, 0, 25, 25, 24, 64, 1, 122, 0, 0, 85, 24, 122, 0, 25, 24, 24, 4, 54, 122, 24, 25, 148, 5, 0, 0, 1, 120, 64, 0, 135, 122, 11, 0, 20, 1, 120, 0, 1, 122, 32, 23, 97, 1, 122, 2, 1, 122, 32, 23, 3, 122, 1, 122, 109, 122, 4, 6, 1, 122, 32, 23, 3, 122, 1, 122, 109, 122, 8, 1, 3, 120, 1, 118, 1, 124, 0, 4, 2, 123, 0, 0, 195, 94, 10, 0, 1, 121, 32, 23, 3, 121, 1, 121, 135, 122, 10, 0, 120, 124, 123, 121, 0, 23, 20, 0, 119, 0, 61, 0, 32, 122, 0, 48, 121, 122, 43, 0, 2, 122, 0, 0, 88, 80, 77, 212, 45, 122, 21, 122, 28, 6, 0, 0, 135, 122, 12, 0, 119, 0, 53, 0, 82, 14, 17, 0, 106, 122, 17, 4, 82, 3, 122, 0, 1, 122, 136, 29, 3, 24, 1, 122, 25, 25, 24, 64, 1, 122, 0, 0, 83, 24, 122, 0, 25, 24, 24, 1, 54, 122, 24, 25, 52, 6, 0, 0, 1, 121, 136, 29, 3, 121, 1, 121, 1, 123, 64, 0, 135, 122, 11, 0, 21, 121, 123, 0, 1, 122, 48, 23, 97, 1, 122, 14, 1, 122, 48, 23, 3, 122, 1, 122, 109, 122, 4, 3, 1, 122, 48, 23, 3, 122, 1, 122, 1, 123, 136, 29, 3, 123, 1, 123, 109, 122, 8, 123, 3, 122, 1, 118, 1, 121, 0, 4, 2, 124, 0, 0, 255, 94, 10, 0, 1, 120, 48, 23, 3, 120, 1, 120, 135, 123, 10, 0, 122, 121, 124, 120, 0, 23, 21, 0, 119, 0, 17, 0, 32, 123, 0, 53, 121, 123, 15, 0, 1, 123, 64, 23, 82, 120, 22, 0, 97, 1, 123, 120, 1, 123, 0, 0, 1, 124, 8, 0, 2, 121, 0, 0, 239, 92, 10, 0, 1, 122, 64, 23, 3, 122, 1, 122, 135, 120, 5, 0, 123, 124, 121, 122, 1, 122, 1, 0, 135, 120, 13, 0, 122, 0, 0, 0, 1, 120, 0, 0, 2, 122, 0, 0, 236, 187, 65, 0, 82, 122, 122, 0, 47, 120, 120, 122, 72, 7, 0, 0, 1, 6, 0, 0, 2, 122, 0, 0, 232, 187, 65, 0, 82, 122, 122, 0, 41, 121, 6, 2, 94, 122, 122, 121, 106, 122, 122, 80, 135, 120, 14, 0, 122, 0, 0, 0, 25, 6, 6, 1, 2, 120, 0, 0, 236, 187, 65, 0, 82, 120, 120, 0, 54, 120, 6, 120, 8, 7, 0, 0, 0, 26, 23, 0, 119, 0, 4, 0, 0, 26, 23, 0, 119, 0, 2, 0, 1, 0, 58, 0, 32, 120, 0, 58, 121, 120, 141, 0, 2, 120, 0, 0, 236, 187, 65, 0, 82, 23, 120, 0, 1, 120, 0, 0, 47, 120, 120, 23, 248, 7, 0, 0, 1, 22, 0, 0, 1, 21, 0, 0, 0, 17, 23, 0, 2, 120, 0, 0, 232, 187, 65, 0, 82, 120, 120, 0, 41, 122, 21, 2, 94, 23, 120, 122, 1, 120, 8, 1, 94, 120, 23, 120, 120, 120, 13, 0, 3, 120, 1, 118, 135, 20, 15, 0, 23, 120, 0, 0, 34, 120, 20, 0, 121, 120, 3, 0, 0, 26, 20, 0, 119, 0, 117, 0, 0, 27, 20, 0, 2, 120, 0, 0, 236, 187, 65, 0, 82, 28, 120, 0, 119, 0, 3, 0, 0, 27, 22, 0, 0, 28, 17, 0, 25, 21, 21, 1, 49, 120, 28, 21, 236, 7, 0, 0, 0, 29, 27, 0, 119, 0, 5, 0, 0, 22, 27, 0, 0, 17, 28, 0, 119, 0, 227, 255, 1, 29, 0, 0, 2, 120, 0, 0, 228, 187, 65, 0, 82, 17, 120, 0, 1, 120, 0, 0, 47, 120, 120, 17, 208, 8, 0, 0, 2, 120, 0, 0, 224, 187, 65, 0, 82, 22, 120, 0, 2, 120, 0, 0, 216, 187, 65, 0, 82, 21, 120, 0, 1, 20, 0, 0, 41, 120, 20, 2, 94, 23, 22, 120, 82, 19, 23, 0, 1, 120, 104, 4, 94, 18, 19, 120, 121, 18, 32, 0, 1, 120, 108, 4, 94, 16, 19, 120, 1, 19, 0, 0, 41, 120, 19, 2, 94, 6, 16, 120, 106, 2, 6, 16, 120, 2, 3, 0, 1, 30, 48, 0, 119, 0, 19, 0, 106, 10, 23, 12, 106, 5, 6, 12, 1, 4, 0, 0, 41, 120, 4, 2, 94, 120, 5, 120, 3, 120, 120, 10, 41, 120, 120, 2, 94, 120, 21, 120, 106, 120, 120, 8, 120, 120, 3, 0, 1, 30, 0, 0, 119, 0, 7, 0, 25, 4, 4, 1, 50, 120, 2, 4, 176, 8, 0, 0, 1, 30, 48, 0, 119, 0, 2, 0, 119, 0, 242, 255, 109, 6, 8, 30, 25, 19, 19, 1, 53, 120, 19, 18, 84, 8, 0, 0, 25, 20, 20, 1, 53, 120, 20, 17, 48, 8, 0, 0, 2, 120, 0, 0, 244, 187, 65, 0, 82, 17, 120, 0, 1, 120, 0, 0, 47, 120, 120, 17, 136, 9, 0, 0, 0, 20, 29, 0, 1, 21, 0, 0, 0, 22, 17, 0, 2, 120, 0, 0, 240, 187, 65, 0, 82, 120, 120, 0, 41, 122, 21, 2, 94, 17, 120, 122, 82, 18, 17, 0, 106, 120, 18, 8, 106, 120, 120, 28, 1, 122, 0, 16, 19, 120, 120, 122, 120, 120, 4, 0, 0, 31, 20, 0, 0, 32, 22, 0, 119, 0, 16, 0, 106, 120, 18, 24, 120, 120, 12, 0, 135, 18, 16, 0, 17, 21, 0, 0, 34, 120, 18, 0, 121, 120, 3, 0, 0, 26, 18, 0, 119, 0, 17, 0, 0, 31, 18, 0, 2, 120, 0, 0, 244, 187, 65, 0, 82, 32, 120, 0, 119, 0, 3, 0, 0, 31, 20, 0, 0, 32, 22, 0, 25, 21, 21, 1, 49, 120, 32, 21, 124, 9, 0, 0, 0, 26, 31, 0, 119, 0, 5, 0, 0, 20, 31, 0, 0, 22, 32, 0, 119, 0, 220, 255, 0, 26, 29, 0, 1, 122, 0, 0, 1, 121, 32, 0, 2, 124, 0, 0, 56, 95, 10, 0, 3, 123, 1, 117, 135, 120, 5, 0, 122, 121, 124, 123, 2, 120, 0, 0, 220, 187, 65, 0, 82, 29, 120, 0, 1, 120, 0, 0, 47, 120, 120, 29, 76, 11, 0, 0, 1, 32, 0, 0, 0, 31, 29, 0, 2, 120, 0, 0, 216, 187, 65, 0, 82, 120, 120, 0, 41, 123, 32, 2, 94, 29, 120, 123, 1, 120, 0, 0, 1, 123, 248, 0, 94, 123, 29, 123, 47, 120, 120, 123, 52, 11, 0, 0, 1, 30, 0, 0, 1, 123, 244, 0, 94, 123, 29, 123, 41, 124, 30, 2, 94, 123, 123, 124, 106, 123, 123, 8, 135, 120, 17, 0, 123, 0, 0, 0, 120, 120, 64, 0, 106, 120, 29, 4, 82, 28, 120, 0, 106, 27, 29, 24, 120, 27, 4, 0, 2, 33, 0, 0, 171, 247, 12, 0, 119, 0, 2, 0, 82, 33, 27, 0, 1, 120, 244, 0, 94, 120, 29, 120, 41, 123, 30, 2, 94, 120, 120, 123, 106, 27, 120, 12, 1, 120, 72, 23, 82, 123, 29, 0, 97, 1, 120, 123, 1, 123, 72, 23, 3, 123, 1, 123, 109, 123, 4, 28, 1, 123, 72, 23, 3, 123, 1, 123, 109, 123, 8, 33, 1, 123, 72, 23, 3, 123, 1, 123, 109, 123, 12, 27, 1, 120, 0, 0, 1, 124, 32, 0, 2, 121, 0, 0, 73, 95, 10, 0, 1, 122, 72, 23, 3, 122, 1, 122, 135, 123, 5, 0, 120, 124, 121, 122, 1, 123, 1, 0, 2, 122, 0, 0, 4, 188, 65, 0, 82, 122, 122, 0, 47, 123, 123, 122, 240, 10, 0, 0, 1, 123, 88, 23, 1, 122, 244, 0, 94, 122, 29, 122, 41, 121, 30, 2, 94, 122, 122, 121, 106, 122, 122, 8, 82, 122, 122, 0, 97, 1, 123, 122, 1, 123, 0, 0, 1, 121, 32, 0, 2, 124, 0, 0, 100, 95, 10, 0, 1, 120, 88, 23, 3, 120, 1, 120, 135, 122, 5, 0, 123, 121, 124, 120, 1, 120, 0, 0, 1, 124, 32, 0, 2, 121, 0, 0, 125, 83, 13, 0, 1, 123, 96, 23, 3, 123, 1, 123, 135, 122, 5, 0, 120, 124, 121, 123, 25, 30, 30, 1, 1, 122, 248, 0, 94, 122, 29, 122, 54, 122, 30, 122, 244, 9, 0, 0, 2, 122, 0, 0, 220, 187, 65, 0, 82, 34, 122, 0, 119, 0, 2, 0, 0, 34, 31, 0, 25, 32, 32, 1, 56, 122, 34, 32, 76, 11, 0, 0, 0, 31, 34, 0, 119, 0, 160, 255, 1, 122, 0, 0, 2, 123, 0, 0, 236, 187, 65, 0, 82, 123, 123, 0, 47, 122, 122, 123, 64, 15, 0, 0, 1, 34, 0, 0, 2, 122, 0, 0, 232, 187, 65, 0, 82, 122, 122, 0, 41, 123, 34, 2, 94, 31, 122, 123, 1, 122, 64, 1, 94, 32, 31, 122, 120, 32, 215, 0, 1, 122, 8, 1, 94, 33, 31, 122, 121, 33, 63, 0, 106, 123, 33, 8, 135, 122, 17, 0, 123, 0, 0, 0, 120, 122, 59, 0, 1, 122, 120, 23, 1, 123, 8, 1, 94, 123, 31, 123, 106, 123, 123, 12, 97, 1, 122, 123, 1, 122, 0, 0, 1, 121, 32, 0, 2, 124, 0, 0, 140, 95, 10, 0, 1, 120, 120, 23, 3, 120, 1, 120, 135, 123, 5, 0, 122, 121, 124, 120, 1, 123, 1, 0, 2, 120, 0, 0, 4, 188, 65, 0, 82, 120, 120, 0, 47, 123, 123, 120, 40, 12, 0, 0, 1, 123, 128, 23, 1, 120, 8, 1, 94, 120, 31, 120, 106, 120, 120, 8, 82, 120, 120, 0, 97, 1, 123, 120, 1, 123, 0, 0, 1, 124, 32, 0, 2, 121, 0, 0, 100, 95, 10, 0, 1, 122, 128, 23, 3, 122, 1, 122, 135, 120, 5, 0, 123, 124, 121, 122, 106, 33, 31, 4, 106, 29, 31, 88, 120, 29, 4, 0, 2, 35, 0, 0, 171, 247, 12, 0, 119, 0, 2, 0, 82, 35, 29, 0, 1, 120, 136, 23, 82, 122, 31, 0, 97, 1, 120, 122, 1, 122, 136, 23, 3, 122, 1, 122, 109, 122, 4, 33, 1, 122, 136, 23, 3, 122, 1, 122, 109, 122, 8, 35, 1, 120, 0, 0, 1, 121, 32, 0, 2, 124, 0, 0, 145, 95, 10, 0, 1, 123, 136, 23, 3, 123, 1, 123, 135, 122, 5, 0, 120, 121, 124, 123, 119, 0, 168, 0, 2, 122, 0, 0, 216, 187, 65, 0, 82, 122, 122, 0, 106, 123, 31, 8, 41, 123, 123, 2, 94, 33, 122, 123, 106, 122, 33, 4, 82, 29, 122, 0, 82, 30, 31, 0, 106, 27, 31, 4, 1, 122, 152, 23, 82, 123, 33, 0, 97, 1, 122, 123, 1, 123, 152, 23, 3, 123, 1, 123, 109, 123, 4, 29, 1, 123, 152, 23, 3, 123, 1, 123, 109, 123, 8, 30, 1, 123, 152, 23, 3, 123, 1, 123, 109, 123, 12, 27, 1, 122, 0, 0, 1, 124, 32, 0, 2, 121, 0, 0, 169, 95, 10, 0, 1, 120, 152, 23, 3, 120, 1, 120, 135, 123, 5, 0, 122, 124, 121, 120, 106, 27, 31, 24, 2, 123, 0, 0, 216, 187, 65, 0, 82, 123, 123, 0, 106, 120, 31, 8, 41, 120, 120, 2, 94, 123, 123, 120, 46, 123, 27, 123, 104, 13, 0, 0, 106, 123, 27, 4, 82, 30, 123, 0, 1, 123, 168, 23, 82, 120, 27, 0, 97, 1, 123, 120, 1, 120, 168, 23, 3, 120, 1, 120, 109, 120, 4, 30, 1, 123, 0, 0, 1, 121, 32, 0, 2, 124, 0, 0, 195, 95, 10, 0, 1, 122, 168, 23, 3, 122, 1, 122, 135, 120, 5, 0, 123, 121, 124, 122, 1, 120, 52, 1, 94, 120, 31, 120, 120, 120, 75, 0, 2, 120, 0, 0, 216, 187, 65, 0, 82, 120, 120, 0, 106, 122, 31, 8, 41, 122, 122, 2, 94, 120, 120, 122, 106, 30, 120, 24, 106, 27, 31, 88, 120, 30, 6, 0, 2, 36, 0, 0, 171, 247, 12, 0, 2, 37, 0, 0, 171, 247, 12, 0, 119, 0, 18, 0, 82, 29, 30, 0, 106, 120, 30, 12, 135, 33, 18, 0, 120, 0, 0, 0, 120, 33, 4, 0, 2, 38, 0, 0, 171, 247, 12, 0, 119, 0, 2, 0, 106, 38, 33, 8, 135, 120, 19, 0, 29, 38, 0, 0, 32, 33, 120, 0, 2, 120, 0, 0, 218, 95, 10, 0, 125, 36, 33, 120, 29, 0, 0, 0, 0, 37, 38, 0, 120, 27, 6, 0, 2, 39, 0, 0, 171, 247, 12, 0, 2, 40, 0, 0, 171, 247, 12, 0, 119, 0, 18, 0, 82, 29, 27, 0, 106, 120, 27, 12, 135, 33, 18, 0, 120, 0, 0, 0, 120, 33, 4, 0, 2, 41, 0, 0, 171, 247, 12, 0, 119, 0, 2, 0, 106, 41, 33, 8, 135, 120, 19, 0, 29, 41, 0, 0, 32, 33, 120, 0, 2, 120, 0, 0, 218, 95, 10, 0, 125, 39, 33, 120, 29, 0, 0, 0, 0, 40, 41, 0, 1, 120, 184, 23, 97, 1, 120, 37, 1, 120, 184, 23, 3, 120, 1, 120, 109, 120, 4, 36, 1, 120, 184, 23, 3, 120, 1, 120, 109, 120, 8, 40, 1, 120, 184, 23, 3, 120, 1, 120, 109, 120, 12, 39, 1, 122, 0, 0, 1, 124, 32, 0, 2, 121, 0, 0, 225, 95, 10, 0, 1, 123, 184, 23, 3, 123, 1, 123, 135, 120, 5, 0, 122, 124, 121, 123, 119, 0, 9, 0, 1, 123, 0, 0, 1, 121, 32, 0, 2, 124, 0, 0, 210, 95, 10, 0, 1, 122, 176, 23, 3, 122, 1, 122, 135, 120, 5, 0, 123, 121, 124, 122, 1, 122, 0, 0, 1, 124, 32, 0, 2, 121, 0, 0, 125, 83, 13, 0, 1, 123, 200, 23, 3, 123, 1, 123, 135, 120, 5, 0, 122, 124, 121, 123, 119, 0, 19, 0, 82, 29, 31, 0, 106, 33, 31, 4, 1, 120, 104, 23, 97, 1, 120, 32, 1, 120, 104, 23, 3, 120, 1, 120, 109, 120, 4, 29, 1, 120, 104, 23, 3, 120, 1, 120, 109, 120, 8, 33, 1, 123, 0, 0, 1, 121, 32, 0, 2, 124, 0, 0, 112, 95, 10, 0, 1, 122, 104, 23, 3, 122, 1, 122, 135, 120, 5, 0, 123, 121, 124, 122, 25, 34, 34, 1, 2, 120, 0, 0, 236, 187, 65, 0, 82, 120, 120, 0, 54, 120, 34, 120, 104, 11, 0, 0, 120, 26, 7, 0, 2, 120, 0, 0, 252, 187, 65, 0, 1, 122, 1, 0, 85, 120, 122, 0, 1, 0, 123, 0, 119, 0, 17, 0, 1, 122, 208, 23, 3, 120, 1, 118, 97, 1, 122, 120, 1, 122, 0, 0, 1, 124, 16, 0, 2, 121, 0, 0, 40, 69, 13, 0, 1, 123, 208, 23, 3, 123, 1, 123, 135, 120, 5, 0, 122, 124, 121, 123, 34, 120, 26, 0, 121, 120, 3, 0, 0, 42, 26, 0, 119, 0, 2, 0, 1, 0, 123, 0, 32, 120, 0, 123, 121, 120, 244, 21, 2, 120, 0, 0, 148, 117, 9, 0, 82, 120, 120, 0, 121, 120, 9, 0, 1, 123, 0, 0, 1, 121, 32, 0, 2, 124, 0, 0, 247, 95, 10, 0, 1, 122, 216, 23, 3, 122, 1, 122, 135, 120, 5, 0, 123, 121, 124, 122, 135, 26, 1, 0, 135, 34, 2, 0, 2, 120, 0, 0, 76, 188, 65, 0, 82, 120, 120, 0, 120, 120, 53, 19, 2, 120, 0, 0, 36, 230, 9, 0, 82, 39, 120, 0, 1, 120, 64, 22, 3, 120, 1, 120, 25, 40, 120, 32, 1, 120, 64, 22, 3, 120, 1, 120, 25, 36, 120, 16, 1, 120, 64, 22, 3, 120, 1, 120, 25, 37, 120, 8, 135, 41, 1, 0, 135, 38, 2, 0, 2, 120, 0, 0, 148, 117, 9, 0, 82, 120, 120, 0, 121, 120, 235, 2, 2, 120, 0, 0, 248, 187, 65, 0, 82, 120, 120, 0, 121, 120, 3, 0, 1, 0, 209, 0, 119, 0, 168, 18, 2, 120, 0, 0, 40, 187, 65, 0, 82, 120, 120, 0, 2, 122, 0, 0, 44, 187, 65, 0, 82, 122, 122, 0, 135, 35, 20, 0, 41, 38, 120, 122, 135, 32, 2, 0, 34, 122, 32, 0, 32, 120, 32, 0, 2, 124, 0, 0, 160, 134, 1, 0, 16, 124, 35, 124, 19, 120, 120, 124, 20, 122, 122, 120, 2, 120, 0, 0, 72, 188, 65, 0, 82, 120, 120, 0, 33, 120, 120, 0, 20, 122, 122, 120, 120, 122, 207, 2, 3, 122, 1, 116, 25, 24, 122, 4, 25, 25, 24, 124, 1, 122, 0, 0, 85, 24, 122, 0, 25, 24, 24, 4, 54, 122, 24, 25, 176, 16, 0, 0, 1, 120, 1, 0, 97, 1, 116, 120, 1, 122, 0, 0, 97, 1, 118, 122, 3, 122, 1, 118, 1, 120, 0, 0, 109, 122, 4, 120, 1, 122, 1, 0, 3, 124, 1, 116, 1, 121, 0, 0, 1, 123, 0, 0, 3, 125, 1, 118, 135, 120, 21, 0, 122, 124, 121, 123, 125, 0, 0, 0, 36, 120, 120, 0, 121, 120, 8, 0, 2, 120, 0, 0, 40, 187, 65, 0, 85, 120, 41, 0, 2, 120, 0, 0, 44, 187, 65, 0, 85, 120, 38, 0, 119, 0, 175, 2, 1, 120, 0, 0, 3, 125, 1, 117, 1, 123, 1, 0, 135, 6, 22, 0, 120, 125, 123, 0, 32, 125, 6, 1, 121, 125, 4, 0, 91, 125, 1, 117, 0, 123, 125, 0, 119, 0, 2, 0, 0, 123, 6, 0, 0, 31, 123, 0, 2, 123, 0, 0, 40, 187, 65, 0, 85, 123, 41, 0, 2, 123, 0, 0, 44, 187, 65, 0, 85, 123, 38, 0, 1, 125, 43, 0, 1, 123, 73, 0, 138, 31, 125, 123, 20, 27, 0, 0, 156, 18, 0, 0, 40, 27, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 60, 27, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 156, 18, 0, 0, 180, 27, 0, 0, 156, 18, 0, 0, 188, 27, 0, 0, 39, 125, 31, 32, 1, 121, 99, 0, 1, 120, 2, 0, 138, 125, 121, 120, 184, 18, 0, 0, 188, 23, 0, 0, 119, 0, 15, 2, 25, 120, 1, 64, 1, 121, 0, 0, 1, 124, 0, 1, 135, 123, 0, 0, 120, 121, 124, 0, 2, 124, 0, 0, 24, 96, 10, 0, 1, 121, 62, 0, 1, 120, 1, 0, 135, 123, 23, 0, 124, 121, 120, 39, 1, 120, 0, 0, 3, 121, 1, 117, 135, 123, 24, 0, 120, 121, 0, 0, 120, 123, 11, 0, 3, 123, 1, 117, 25, 6, 123, 12, 82, 123, 6, 0, 39, 123, 123, 8, 85, 6, 123, 0, 1, 121, 0, 0, 1, 120, 0, 0, 3, 124, 1, 117, 135, 123, 25, 0, 121, 120, 124, 0, 1, 6, 0, 0, 1, 123, 255, 15, 16, 33, 6, 123, 3, 123, 1, 116, 25, 24, 123, 4, 25, 25, 24, 124, 1, 123, 0, 0, 85, 24, 123, 0, 25, 24, 24, 4, 54, 123, 24, 25, 56, 19, 0, 0, 1, 124, 1, 0, 97, 1, 116, 124, 1, 123, 0, 0, 97, 1, 118, 123, 3, 123, 1, 118, 1, 124, 0, 0, 109, 123, 4, 124, 1, 124, 0, 0, 1, 120, 1, 0, 3, 121, 1, 116, 1, 122, 0, 0, 1, 126, 0, 0, 3, 127, 1, 118, 135, 123, 21, 0, 120, 121, 122, 126, 127, 0, 0, 0, 47, 124, 124, 123, 192, 19, 0, 0, 1, 124, 0, 0, 3, 123, 1, 117, 1, 127, 1, 0, 135, 29, 22, 0, 124, 123, 127, 0, 33, 127, 29, 1, 121, 127, 3, 0, 0, 43, 29, 0, 119, 0, 4, 0, 91, 43, 1, 117, 119, 0, 2, 0, 1, 43, 255, 255, 120, 33, 2, 0, 119, 0, 17, 0, 1, 127, 10, 0, 1, 123, 4, 0, 138, 43, 127, 123, 236, 19, 0, 0, 232, 19, 0, 0, 232, 19, 0, 0, 240, 19, 0, 0, 119, 0, 3, 0, 119, 0, 8, 0, 119, 0, 7, 0, 36, 127, 43, 0, 120, 127, 205, 255, 3, 127, 1, 119, 95, 127, 6, 43, 25, 6, 6, 1, 119, 0, 199, 255, 3, 127, 1, 119, 1, 123, 0, 0, 95, 127, 6, 123, 1, 127, 0, 0, 3, 124, 1, 117, 135, 123, 24, 0, 127, 124, 0, 0, 120, 123, 11, 0, 3, 123, 1, 117, 25, 33, 123, 12, 82, 123, 33, 0, 38, 123, 123, 247, 85, 33, 123, 0, 1, 124, 0, 0, 1, 127, 0, 0, 3, 126, 1, 117, 135, 123, 25, 0, 124, 127, 126, 0, 1, 126, 10, 0, 135, 123, 26, 0, 126, 39, 0, 0, 1, 123, 0, 0, 47, 123, 123, 43, 104, 23, 0, 0, 1, 123, 224, 23, 97, 1, 123, 1, 1, 123, 224, 23, 3, 123, 1, 123, 1, 126, 64, 22, 3, 126, 1, 126, 109, 123, 4, 126, 1, 126, 224, 23, 3, 126, 1, 126, 1, 123, 64, 1, 3, 123, 1, 123, 109, 126, 8, 123, 1, 123, 224, 23, 3, 123, 1, 123, 25, 126, 1, 64, 109, 123, 12, 126, 3, 126, 1, 119, 2, 123, 0, 0, 87, 96, 10, 0, 1, 127, 224, 23, 3, 127, 1, 127, 135, 33, 27, 0, 126, 123, 127, 0, 36, 127, 33, 2, 121, 127, 4, 0, 0, 44, 33, 0, 1, 0, 173, 0, 119, 0, 166, 0, 1, 127, 64, 22, 98, 45, 1, 127, 1, 127, 240, 23, 97, 1, 127, 1, 1, 127, 240, 23, 3, 127, 1, 127, 111, 127, 8, 45, 1, 127, 240, 23, 3, 127, 1, 127, 1, 123, 64, 1, 3, 123, 1, 123, 109, 127, 16, 123, 1, 123, 240, 23, 3, 123, 1, 123, 25, 127, 1, 64, 109, 123, 20, 127, 1, 123, 0, 0, 1, 126, 48, 0, 2, 124, 0, 0, 117, 96, 10, 0, 1, 122, 240, 23, 3, 122, 1, 122, 135, 127, 5, 0, 123, 126, 124, 122, 2, 127, 0, 0, 4, 188, 65, 0, 82, 127, 127, 0, 36, 127, 127, 0, 120, 127, 137, 0, 32, 127, 31, 99, 121, 127, 54, 0, 1, 33, 0, 0, 2, 127, 0, 0, 0, 188, 65, 0, 82, 127, 127, 0, 41, 122, 33, 2, 94, 127, 127, 122, 106, 29, 127, 8, 121, 29, 39, 0, 1, 127, 64, 22, 98, 127, 1, 127, 59, 122, 0, 0, 71, 127, 127, 122, 121, 127, 27, 0, 1, 127, 64, 1, 3, 127, 1, 127, 25, 122, 1, 64, 3, 124, 1, 119, 1, 126, 0, 16, 32, 123, 31, 99, 38, 123, 123, 1, 135, 27, 28, 0, 29, 1, 127, 122, 124, 126, 123, 0, 1, 123, 8, 24, 97, 1, 123, 33, 1, 123, 8, 24, 3, 123, 1, 123, 109, 123, 4, 27, 1, 123, 8, 24, 3, 123, 1, 123, 3, 126, 1, 119, 109, 123, 8, 126, 2, 123, 0, 0, 253, 96, 10, 0, 1, 124, 8, 24, 3, 124, 1, 124, 135, 126, 29, 0, 39, 123, 124, 0, 119, 0, 8, 0, 2, 124, 0, 0, 172, 96, 10, 0, 1, 123, 80, 0, 1, 122, 1, 0, 135, 126, 23, 0, 124, 123, 122, 39, 119, 0, 1, 0, 25, 33, 33, 1, 2, 126, 0, 0, 4, 188, 65, 0, 82, 126, 126, 0, 56, 126, 126, 33, 112, 23, 0, 0, 119, 0, 205, 255, 1, 33, 0, 0, 2, 126, 0, 0, 0, 188, 65, 0, 82, 126, 126, 0, 41, 122, 33, 2, 94, 126, 126, 122, 106, 29, 126, 8, 121, 29, 65, 0, 1, 126, 64, 22, 98, 45, 1, 126, 59, 126, 0, 0, 71, 126, 45, 126, 121, 126, 27, 0, 1, 126, 64, 1, 3, 126, 1, 126, 25, 122, 1, 64, 3, 123, 1, 119, 1, 124, 0, 16, 32, 127, 31, 99, 38, 127, 127, 1, 135, 27, 28, 0, 29, 1, 126, 122, 123, 124, 127, 0, 1, 127, 24, 24, 97, 1, 127, 33, 1, 127, 24, 24, 3, 127, 1, 127, 109, 127, 4, 27, 1, 127, 24, 24, 3, 127, 1, 127, 3, 124, 1, 119, 109, 127, 8, 124, 2, 127, 0, 0, 253, 96, 10, 0, 1, 123, 24, 24, 3, 123, 1, 123, 135, 124, 29, 0, 39, 127, 123, 0, 119, 0, 34, 0, 1, 124, 64, 1, 3, 124, 1, 124, 25, 123, 1, 64, 1, 127, 0, 0, 135, 27, 30, 0, 29, 1, 124, 123, 127, 45, 0, 0, 1, 127, 0, 0, 56, 127, 127, 27, 76, 23, 0, 0, 1, 127, 136, 29, 3, 24, 1, 127, 25, 25, 24, 64, 1, 127, 0, 0, 83, 24, 127, 0, 25, 24, 24, 1, 54, 127, 24, 25, 252, 22, 0, 0, 1, 123, 136, 29, 3, 123, 1, 123, 1, 124, 64, 0, 135, 127, 11, 0, 27, 123, 124, 0, 1, 127, 40, 24, 1, 124, 136, 29, 3, 124, 1, 124, 97, 1, 127, 124, 2, 127, 0, 0, 41, 97, 10, 0, 1, 123, 40, 24, 3, 123, 1, 123, 135, 124, 29, 0, 39, 127, 123, 0, 25, 33, 33, 1, 2, 124, 0, 0, 4, 188, 65, 0, 82, 124, 124, 0, 54, 124, 33, 124, 48, 22, 0, 0, 119, 0, 3, 0, 1, 44, 0, 0, 1, 0, 173, 0, 1, 124, 173, 0, 45, 124, 0, 124, 184, 23, 0, 0, 1, 0, 0, 0, 1, 124, 48, 24, 97, 1, 124, 44, 1, 124, 48, 24, 3, 124, 1, 124, 3, 123, 1, 119, 109, 124, 4, 123, 1, 124, 0, 0, 1, 127, 16, 0, 2, 122, 0, 0, 79, 97, 10, 0, 1, 126, 48, 24, 3, 126, 1, 126, 135, 123, 5, 0, 124, 127, 122, 126, 119, 0, 206, 0, 1, 126, 0, 0, 97, 1, 119, 126, 32, 126, 31, 68, 121, 126, 22, 0, 2, 126, 0, 0, 216, 187, 65, 0, 82, 126, 126, 0, 82, 126, 126, 0, 106, 126, 126, 4, 106, 126, 126, 8, 94, 126, 126, 119, 41, 126, 126, 1, 0, 6, 126, 0, 32, 126, 6, 0, 1, 123, 1, 0, 125, 33, 126, 123, 6, 0, 0, 0, 38, 123, 33, 64, 120, 123, 2, 0, 119, 0, 4, 0, 41, 123, 33, 1, 0, 33, 123, 0, 119, 0, 251, 255, 97, 1, 119, 33, 119, 0, 125, 0, 1, 126, 0, 0, 3, 122, 1, 117, 135, 123, 24, 0, 126, 122, 0, 0, 120, 123, 11, 0, 3, 123, 1, 117, 25, 6, 123, 12, 82, 123, 6, 0, 39, 123, 123, 8, 85, 6, 123, 0, 1, 122, 0, 0, 1, 126, 0, 0, 3, 127, 1, 117, 135, 123, 25, 0, 122, 126, 127, 0, 1, 6, 0, 0, 35, 29, 6, 31, 3, 123, 1, 116, 25, 24, 123, 4, 25, 25, 24, 124, 1, 123, 0, 0, 85, 24, 123, 0, 25, 24, 24, 4, 54, 123, 24, 25, 112, 24, 0, 0, 1, 127, 1, 0, 97, 1, 116, 127, 1, 123, 0, 0, 97, 1, 118, 123, 3, 123, 1, 118, 1, 127, 0, 0, 109, 123, 4, 127, 1, 127, 0, 0, 1, 126, 1, 0, 3, 122, 1, 116, 1, 124, 0, 0, 1, 121, 0, 0, 3, 120, 1, 118, 135, 123, 21, 0, 126, 122, 124, 121, 120, 0, 0, 0, 47, 127, 127, 123, 248, 24, 0, 0, 1, 127, 0, 0, 3, 123, 1, 117, 1, 120, 1, 0, 135, 30, 22, 0, 127, 123, 120, 0, 33, 120, 30, 1, 121, 120, 3, 0, 0, 46, 30, 0, 119, 0, 4, 0, 91, 46, 1, 117, 119, 0, 2, 0, 1, 46, 255, 255, 120, 29, 2, 0, 119, 0, 18, 0, 1, 120, 10, 0, 1, 123, 4, 0, 138, 46, 120, 123, 36, 25, 0, 0, 32, 25, 0, 0, 32, 25, 0, 0, 40, 25, 0, 0, 119, 0, 3, 0, 119, 0, 9, 0, 119, 0, 8, 0, 36, 120, 46, 0, 120, 120, 205, 255, 1, 120, 64, 1, 3, 120, 1, 120, 95, 120, 6, 46, 25, 6, 6, 1, 119, 0, 199, 255, 1, 120, 64, 1, 3, 120, 1, 120, 1, 123, 0, 0, 95, 120, 6, 123, 1, 120, 0, 0, 3, 127, 1, 117, 135, 123, 24, 0, 120, 127, 0, 0, 120, 123, 11, 0, 3, 123, 1, 117, 25, 33, 123, 12, 82, 123, 33, 0, 38, 123, 123, 247, 85, 33, 123, 0, 1, 127, 0, 0, 1, 120, 0, 0, 3, 121, 1, 117, 135, 123, 25, 0, 127, 120, 121, 0, 1, 121, 10, 0, 135, 123, 26, 0, 121, 39, 0, 0, 34, 123, 46, 1, 121, 123, 3, 0, 1, 0, 193, 0, 119, 0, 15, 0, 1, 123, 56, 24, 3, 121, 1, 119, 97, 1, 123, 121, 1, 123, 64, 1, 3, 123, 1, 123, 2, 120, 0, 0, 11, 84, 13, 0, 1, 127, 56, 24, 3, 127, 1, 127, 135, 121, 27, 0, 123, 120, 127, 0, 33, 121, 121, 1, 121, 121, 2, 0, 1, 0, 193, 0, 1, 121, 193, 0, 45, 121, 0, 121, 16, 26, 0, 0, 1, 0, 0, 0, 2, 127, 0, 0, 158, 97, 10, 0, 1, 120, 26, 0, 1, 123, 1, 0, 135, 121, 23, 0, 127, 120, 123, 39, 2, 121, 0, 0, 220, 187, 65, 0, 82, 33, 121, 0, 1, 121, 0, 0, 47, 121, 121, 33, 92, 26, 0, 0, 94, 29, 1, 119, 2, 121, 0, 0, 216, 187, 65, 0, 82, 30, 121, 0, 1, 28, 0, 0, 41, 121, 28, 2, 94, 121, 30, 121, 106, 121, 121, 4, 106, 121, 121, 8, 97, 121, 119, 29, 25, 28, 28, 1, 53, 121, 28, 33, 60, 26, 0, 0, 2, 121, 0, 0, 236, 187, 65, 0, 82, 33, 121, 0, 1, 121, 0, 0, 47, 121, 121, 33, 172, 26, 0, 0, 2, 121, 0, 0, 232, 187, 65, 0, 82, 28, 121, 0, 94, 29, 1, 119, 1, 30, 0, 0, 41, 121, 30, 2, 94, 121, 28, 121, 106, 121, 121, 80, 97, 121, 119, 29, 25, 30, 30, 1, 53, 121, 30, 33, 136, 26, 0, 0, 0, 47, 29, 0, 119, 0, 2, 0, 94, 47, 1, 119, 120, 47, 3, 0, 1, 48, 0, 0, 119, 0, 5, 0, 1, 123, 48, 0, 135, 121, 31, 0, 123, 0, 0, 0, 94, 48, 1, 119, 1, 121, 64, 24, 97, 1, 121, 48, 2, 123, 0, 0, 185, 97, 10, 0, 1, 120, 64, 24, 3, 120, 1, 120, 135, 121, 29, 0, 39, 123, 120, 0, 119, 0, 1, 0, 33, 125, 31, 63, 120, 125, 58, 0, 2, 121, 0, 0, 195, 97, 10, 0, 1, 120, 83, 1, 1, 123, 1, 0, 135, 125, 23, 0, 121, 120, 123, 39, 119, 0, 51, 0, 135, 125, 32, 0, 25, 125, 125, 10, 135, 123, 31, 0, 125, 0, 0, 0, 119, 0, 46, 0, 135, 125, 32, 0, 26, 125, 125, 10, 135, 123, 31, 0, 125, 0, 0, 0, 119, 0, 41, 0, 2, 125, 0, 0, 76, 187, 65, 0, 82, 125, 125, 0, 120, 125, 15, 0, 2, 125, 0, 0, 80, 187, 65, 0, 82, 125, 125, 0, 120, 125, 6, 0, 2, 125, 0, 0, 80, 187, 65, 0, 1, 123, 1, 0, 85, 125, 123, 0, 119, 0, 14, 0, 2, 123, 0, 0, 76, 187, 65, 0, 1, 125, 1, 0, 85, 123, 125, 0, 119, 0, 9, 0, 2, 125, 0, 0, 80, 187, 65, 0, 1, 123, 0, 0, 85, 125, 123, 0, 2, 123, 0, 0, 76, 187, 65, 0, 1, 125, 0, 0, 85, 123, 125, 0, 1, 123, 48, 0, 135, 125, 31, 0, 123, 0, 0, 0, 119, 0, 11, 0, 1, 0, 209, 0, 119, 0, 204, 15, 2, 123, 0, 0, 104, 187, 65, 0, 2, 125, 0, 0, 104, 187, 65, 0, 82, 125, 125, 0, 40, 125, 125, 1, 85, 123, 125, 0, 119, 0, 1, 0, 2, 125, 0, 0, 236, 187, 65, 0, 82, 125, 125, 0, 36, 125, 125, 0, 121, 125, 3, 0, 1, 0, 222, 0, 119, 0, 189, 15, 1, 35, 0, 0, 2, 125, 0, 0, 232, 187, 65, 0, 82, 125, 125, 0, 41, 123, 35, 2, 94, 32, 125, 123, 2, 125, 0, 0, 240, 187, 65, 0, 82, 125, 125, 0, 82, 123, 32, 0, 41, 123, 123, 2, 94, 29, 125, 123, 1, 125, 44, 1, 94, 125, 32, 125, 120, 125, 130, 0, 82, 125, 29, 0, 106, 33, 125, 16, 121, 33, 25, 0, 1, 125, 0, 0, 1, 123, 0, 0, 1, 120, 1, 0, 135, 30, 33, 0, 33, 125, 123, 120, 135, 33, 2, 0, 25, 120, 29, 32, 106, 28, 120, 4, 48, 123, 33, 28, 116, 28, 0, 0, 1, 123, 1, 0, 0, 120, 123, 0, 119, 0, 10, 0, 45, 125, 33, 28, 140, 28, 0, 0, 106, 125, 29, 32, 16, 125, 30, 125, 0, 123, 125, 0, 119, 0, 3, 0, 1, 125, 0, 0, 0, 123, 125, 0, 0, 120, 123, 0, 120, 120, 2, 0, 119, 0, 103, 0, 106, 30, 32, 20, 25, 120, 32, 96, 106, 28, 120, 4, 34, 123, 30, 0, 41, 123, 123, 31, 42, 123, 123, 31, 47, 123, 123, 28, 204, 28, 0, 0, 1, 123, 1, 0, 0, 120, 123, 0, 119, 0, 13, 0, 34, 125, 30, 0, 41, 125, 125, 31, 42, 125, 125, 31, 45, 125, 28, 125, 240, 28, 0, 0, 106, 125, 32, 96, 16, 125, 30, 125, 0, 123, 125, 0, 119, 0, 3, 0, 1, 125, 0, 0, 0, 123, 125, 0, 0, 120, 123, 0, 120, 120, 88, 0, 82, 120, 29, 0, 106, 120, 120, 24, 121, 120, 76, 0, 1, 30, 0, 0, 2, 120, 0, 0, 232, 187, 65, 0, 82, 120, 120, 0, 106, 123, 29, 8, 3, 123, 123, 30, 41, 123, 123, 2, 94, 28, 120, 123, 2, 120, 0, 0, 240, 187, 65, 0, 82, 120, 120, 0, 82, 123, 28, 0, 41, 123, 123, 2, 94, 33, 120, 123, 1, 120, 44, 1, 1, 123, 44, 1, 94, 123, 28, 123, 39, 123, 123, 1, 97, 28, 120, 123, 106, 123, 33, 40, 121, 123, 50, 0, 106, 123, 28, 32, 25, 120, 28, 32, 106, 120, 120, 4, 106, 125, 28, 40, 25, 121, 28, 40, 106, 121, 121, 4, 135, 6, 20, 0, 123, 120, 125, 121, 135, 22, 2, 0, 106, 121, 28, 80, 25, 20, 121, 76, 1, 125, 1, 0, 97, 1, 116, 125, 3, 125, 1, 116, 25, 28, 125, 4, 2, 125, 0, 0, 64, 66, 15, 0, 85, 28, 125, 0, 82, 121, 20, 0, 97, 1, 118, 121, 3, 121, 1, 118, 106, 125, 20, 4, 109, 121, 4, 125, 94, 121, 1, 116, 97, 1, 117, 121, 3, 121, 1, 117, 82, 125, 28, 0, 109, 121, 4, 125, 3, 125, 1, 118, 3, 121, 1, 117, 135, 28, 34, 0, 6, 22, 125, 121, 135, 22, 2, 0, 106, 6, 33, 16, 25, 121, 33, 16, 25, 20, 121, 4, 82, 21, 20, 0, 15, 121, 22, 21, 13, 125, 21, 22, 16, 120, 28, 6, 19, 125, 125, 120, 20, 121, 121, 125, 0, 18, 121, 0, 125, 125, 18, 28, 6, 0, 0, 0, 109, 33, 16, 125, 125, 125, 18, 22, 21, 0, 0, 0, 85, 20, 125, 0, 25, 30, 30, 1, 82, 125, 29, 0, 106, 125, 125, 24, 55, 125, 30, 125, 16, 29, 0, 0, 25, 35, 35, 1, 2, 125, 0, 0, 236, 187, 65, 0, 82, 125, 125, 0, 49, 125, 125, 35, 88, 30, 0, 0, 1, 0, 222, 0, 119, 0, 37, 15, 119, 0, 105, 255, 1, 125, 0, 0, 2, 121, 0, 0, 236, 187, 65, 0, 82, 121, 121, 0, 47, 125, 125, 121, 144, 90, 0, 0, 1, 35, 0, 0, 1, 29, 0, 0, 2, 32, 0, 0, 255, 255, 255, 127, 1, 31, 255, 255, 2, 125, 0, 0, 232, 187, 65, 0, 82, 125, 125, 0, 41, 121, 35, 2, 94, 49, 125, 121, 106, 30, 49, 12, 1, 125, 200, 0, 94, 21, 30, 125, 1, 125, 200, 0, 3, 125, 30, 125, 106, 22, 125, 4, 32, 125, 21, 0, 2, 121, 0, 0, 0, 0, 0, 128, 13, 121, 22, 121, 19, 125, 125, 121, 121, 125, 6, 0, 1, 50, 0, 0, 2, 51, 0, 0, 0, 0, 0, 128, 1, 0, 228, 0, 119, 0, 45, 0, 1, 121, 1, 0, 97, 1, 116, 121, 3, 121, 1, 116, 25, 18, 121, 4, 2, 121, 0, 0, 64, 66, 15, 0, 85, 18, 121, 0, 106, 125, 30, 16, 97, 1, 118, 125, 3, 125, 1, 118, 25, 121, 30, 16, 106, 121, 121, 4, 109, 125, 4, 121, 94, 125, 1, 116, 97, 1, 117, 125, 3, 125, 1, 117, 82, 121, 18, 0, 109, 125, 4, 121, 3, 121, 1, 118, 3, 125, 1, 117, 135, 18, 34, 0, 21, 22, 121, 125, 135, 22, 2, 0, 106, 125, 49, 12, 1, 121, 200, 0, 3, 21, 125, 121, 82, 125, 21, 0, 32, 125, 125, 0, 121, 125, 7, 0, 106, 125, 21, 4, 2, 120, 0, 0, 0, 0, 0, 128, 13, 125, 125, 120, 0, 121, 125, 0, 119, 0, 3, 0, 1, 125, 0, 0, 0, 121, 125, 0, 121, 121, 5, 0, 0, 50, 18, 0, 0, 51, 22, 0, 1, 0, 228, 0, 119, 0, 3, 0, 0, 52, 22, 0, 0, 53, 18, 0, 1, 121, 228, 0, 45, 121, 0, 121, 200, 31, 0, 0, 1, 0, 0, 0, 1, 125, 0, 0, 1, 120, 48, 0, 2, 123, 0, 0, 71, 99, 10, 0, 1, 127, 80, 24, 3, 127, 1, 127, 135, 121, 5, 0, 125, 120, 123, 127, 0, 52, 51, 0, 0, 53, 50, 0, 1, 121, 56, 1, 94, 121, 49, 121, 120, 121, 6, 0, 1, 121, 60, 1, 94, 121, 49, 121, 120, 121, 3, 0, 1, 0, 231, 0, 119, 0, 35, 0, 15, 121, 52, 32, 13, 127, 52, 32, 16, 123, 53, 31, 19, 127, 127, 123, 20, 121, 121, 127, 1, 127, 44, 1, 94, 127, 49, 127, 32, 127, 127, 0, 19, 121, 121, 127, 121, 121, 10, 0, 1, 121, 48, 1, 94, 121, 49, 121, 32, 121, 121, 0, 1, 127, 0, 0, 125, 54, 121, 49, 127, 0, 0, 0, 0, 55, 53, 0, 0, 56, 52, 0, 119, 0, 4, 0, 0, 54, 29, 0, 0, 55, 31, 0, 0, 56, 32, 0, 25, 35, 35, 1, 2, 127, 0, 0, 236, 187, 65, 0, 82, 57, 127, 0, 49, 127, 57, 35, 96, 32, 0, 0, 1, 0, 235, 0, 119, 0, 5, 0, 0, 29, 54, 0, 0, 32, 56, 0, 0, 31, 55, 0, 119, 0, 135, 255, 1, 127, 231, 0, 45, 127, 0, 127, 136, 32, 0, 0, 1, 0, 0, 0, 0, 58, 49, 0, 119, 0, 56, 0, 1, 127, 235, 0, 45, 127, 0, 127, 100, 33, 0, 0, 1, 0, 0, 0, 120, 54, 50, 0, 36, 127, 57, 0, 121, 127, 3, 0, 1, 0, 246, 0, 119, 0, 123, 14, 2, 127, 0, 0, 232, 187, 65, 0, 82, 31, 127, 0, 1, 32, 0, 0, 41, 127, 32, 2, 94, 127, 31, 127, 1, 121, 48, 1, 94, 127, 127, 121, 120, 127, 7, 0, 25, 32, 32, 1, 49, 127, 57, 32, 228, 32, 0, 0, 1, 0, 246, 0, 119, 0, 109, 14, 119, 0, 246, 255, 2, 127, 0, 0, 228, 187, 65, 0, 82, 32, 127, 0, 1, 127, 0, 0, 47, 127, 127, 32, 44, 33, 0, 0, 2, 127, 0, 0, 224, 187, 65, 0, 82, 29, 127, 0, 1, 35, 0, 0, 41, 127, 35, 2, 94, 127, 29, 127, 1, 121, 0, 0, 109, 127, 8, 121, 25, 35, 35, 1, 53, 121, 35, 32, 16, 33, 0, 0, 1, 32, 0, 0, 41, 121, 32, 2, 94, 121, 31, 121, 1, 127, 48, 1, 1, 123, 0, 0, 97, 121, 127, 123, 25, 32, 32, 1, 53, 123, 32, 57, 48, 33, 0, 0, 1, 127, 16, 39, 135, 123, 35, 0, 127, 0, 0, 0, 119, 0, 78, 14, 0, 58, 54, 0, 1, 123, 8, 1, 3, 32, 58, 123, 82, 31, 32, 0, 120, 31, 3, 0, 1, 0, 32, 1, 119, 0, 39, 1, 106, 35, 31, 8, 106, 29, 35, 8, 120, 29, 83, 0, 106, 18, 35, 20, 1, 123, 0, 0, 47, 123, 123, 18, 224, 33, 0, 0, 106, 22, 35, 16, 1, 21, 0, 0, 41, 123, 21, 2, 94, 30, 22, 123, 106, 123, 30, 24, 34, 123, 123, 0, 121, 123, 6, 0, 106, 123, 30, 16, 35, 123, 123, 2, 121, 123, 3, 0, 0, 59, 31, 0, 119, 0, 8, 0, 25, 21, 21, 1, 49, 123, 18, 21, 220, 33, 0, 0, 1, 0, 254, 0, 119, 0, 3, 0, 119, 0, 241, 255, 1, 0, 254, 0, 1, 123, 254, 0, 45, 123, 0, 123, 52, 34, 0, 0, 1, 0, 0, 0, 135, 18, 36, 0, 35, 0, 0, 0, 34, 123, 18, 0, 121, 123, 11, 0, 1, 127, 0, 0, 1, 121, 16, 0, 2, 120, 0, 0, 193, 99, 10, 0, 1, 125, 96, 24, 3, 125, 1, 125, 135, 123, 5, 0, 127, 121, 120, 125, 0, 60, 18, 0, 119, 0, 251, 0, 82, 59, 32, 0, 119, 0, 1, 0, 120, 59, 3, 0, 1, 0, 32, 1, 119, 0, 246, 0, 106, 18, 59, 8, 106, 21, 18, 8, 121, 21, 4, 0, 0, 61, 18, 0, 0, 62, 21, 0, 119, 0, 33, 0, 106, 21, 18, 20, 1, 123, 0, 0, 47, 123, 123, 21, 192, 34, 0, 0, 2, 123, 0, 0, 224, 187, 65, 0, 82, 22, 123, 0, 106, 27, 18, 16, 1, 18, 0, 0, 41, 123, 18, 2, 94, 123, 27, 123, 106, 30, 123, 4, 1, 123, 88, 1, 94, 123, 30, 123, 120, 123, 9, 0, 82, 123, 30, 0, 41, 123, 123, 2, 94, 123, 22, 123, 106, 123, 123, 4, 120, 123, 4, 0, 0, 63, 30, 0, 1, 0, 35, 1, 119, 0, 217, 0, 25, 18, 18, 1, 54, 123, 18, 21, 124, 34, 0, 0, 1, 123, 60, 1, 1, 125, 1, 0, 97, 58, 123, 125, 119, 0, 242, 13, 0, 61, 35, 0, 0, 62, 29, 0, 1, 125, 56, 1, 94, 125, 58, 125, 120, 125, 18, 0, 3, 123, 1, 118, 1, 120, 0, 0, 1, 121, 0, 4, 135, 125, 0, 0, 123, 120, 121, 0, 3, 121, 1, 118, 135, 125, 15, 0, 58, 121, 0, 0, 34, 125, 125, 0, 121, 125, 3, 0, 1, 0, 5, 1, 119, 0, 246, 13, 82, 125, 32, 0, 106, 29, 125, 8, 106, 64, 29, 8, 0, 65, 29, 0, 119, 0, 3, 0, 0, 64, 62, 0, 0, 65, 61, 0, 135, 29, 37, 0, 64, 0, 0, 0, 1, 125, 255, 255, 47, 125, 125, 29, 84, 35, 0, 0, 1, 125, 0, 0, 135, 66, 38, 0, 125, 0, 0, 0, 119, 0, 173, 0, 34, 125, 29, 245, 121, 125, 97, 0, 2, 125, 0, 0, 187, 176, 185, 223, 1, 121, 1, 0, 138, 29, 125, 121, 120, 35, 0, 0, 0, 60, 29, 0, 119, 0, 168, 0, 119, 0, 1, 0, 1, 125, 1, 0, 135, 35, 38, 0, 125, 0, 0, 0, 25, 21, 65, 28, 82, 18, 21, 0, 36, 125, 18, 0, 121, 125, 3, 0, 0, 66, 35, 0, 119, 0, 154, 0, 25, 22, 65, 24, 1, 27, 0, 0, 0, 30, 18, 0, 82, 125, 22, 0, 41, 121, 27, 2, 94, 125, 125, 121, 106, 18, 125, 4, 2, 125, 0, 0, 240, 187, 65, 0, 82, 125, 125, 0, 82, 121, 18, 0, 41, 121, 121, 2, 94, 20, 125, 121, 1, 125, 44, 1, 1, 121, 44, 1, 94, 121, 18, 121, 39, 121, 121, 1, 97, 18, 125, 121, 106, 121, 20, 40, 120, 121, 3, 0, 0, 67, 30, 0, 119, 0, 51, 0, 106, 121, 18, 32, 25, 125, 18, 32, 106, 125, 125, 4, 106, 120, 18, 40, 25, 123, 18, 40, 106, 123, 123, 4, 135, 6, 20, 0, 121, 125, 120, 123, 135, 28, 2, 0, 106, 123, 18, 80, 25, 33, 123, 76, 1, 120, 1, 0, 97, 1, 116, 120, 3, 120, 1, 116, 25, 18, 120, 4, 2, 120, 0, 0, 64, 66, 15, 0, 85, 18, 120, 0, 82, 123, 33, 0, 97, 1, 118, 123, 3, 123, 1, 118, 106, 120, 33, 4, 109, 123, 4, 120, 94, 123, 1, 116, 97, 1, 117, 123, 3, 123, 1, 117, 82, 120, 18, 0, 109, 123, 4, 120, 3, 120, 1, 118, 3, 123, 1, 117, 135, 18, 34, 0, 6, 28, 120, 123, 135, 28, 2, 0, 106, 6, 20, 16, 25, 123, 20, 16, 25, 33, 123, 4, 82, 17, 33, 0, 15, 123, 28, 17, 13, 120, 17, 28, 16, 125, 18, 6, 19, 120, 120, 125, 20, 123, 123, 120, 0, 19, 123, 0, 125, 120, 19, 18, 6, 0, 0, 0, 109, 20, 16, 120, 125, 120, 19, 28, 17, 0, 0, 0, 85, 33, 120, 0, 82, 67, 21, 0, 25, 27, 27, 1, 49, 120, 67, 27, 212, 36, 0, 0, 0, 66, 35, 0, 119, 0, 77, 0, 0, 30, 67, 0, 119, 0, 181, 255, 1, 120, 245, 255, 1, 123, 1, 0, 138, 29, 120, 123, 244, 36, 0, 0, 0, 60, 29, 0, 119, 0, 73, 0, 119, 0, 1, 0, 25, 30, 65, 20, 82, 35, 30, 0, 1, 120, 0, 0, 47, 120, 120, 35, 200, 37, 0, 0, 25, 27, 65, 16, 1, 21, 0, 0, 1, 22, 0, 0, 1, 17, 0, 0, 0, 28, 35, 0, 82, 120, 27, 0, 41, 123, 22, 2, 94, 35, 120, 123, 106, 19, 35, 4, 2, 120, 0, 0, 224, 187, 65, 0, 82, 120, 120, 0, 82, 123, 19, 0, 41, 123, 123, 2, 94, 33, 120, 123, 106, 120, 33, 8, 120, 120, 17, 0, 106, 120, 33, 4, 121, 120, 5, 0, 0, 68, 21, 0, 0, 69, 17, 0, 0, 70, 28, 0, 119, 0, 14, 0, 82, 120, 35, 0, 135, 6, 39, 0, 120, 0, 0, 0, 15, 18, 21, 6, 125, 68, 18, 6, 21, 0, 0, 0, 125, 69, 18, 19, 17, 0, 0, 0, 82, 70, 30, 0, 119, 0, 4, 0, 0, 68, 21, 0, 0, 69, 17, 0, 0, 70, 28, 0, 25, 22, 22, 1, 56, 120, 70, 22, 184, 37, 0, 0, 0, 21, 68, 0, 0, 17, 69, 0, 0, 28, 70, 0, 119, 0, 219, 255, 121, 69, 4, 0, 0, 63, 69, 0, 1, 0, 35, 1, 119, 0, 20, 0, 106, 28, 65, 28, 36, 120, 28, 0, 120, 120, 49, 13, 106, 17, 65, 24, 1, 21, 0, 0, 41, 120, 21, 2, 94, 120, 17, 120, 106, 120, 120, 4, 1, 123, 48, 1, 1, 125, 1, 0, 97, 120, 123, 125, 25, 21, 21, 1, 52, 125, 21, 28, 148, 90, 0, 0, 119, 0, 247, 255, 34, 125, 66, 0, 121, 125, 35, 13, 0, 60, 66, 0, 119, 0, 1, 0, 1, 125, 32, 1, 45, 125, 0, 125, 80, 38, 0, 0, 1, 0, 0, 0, 106, 32, 58, 8, 36, 125, 32, 255, 121, 125, 3, 0, 1, 0, 33, 1, 119, 0, 45, 13, 2, 125, 0, 0, 216, 187, 65, 0, 82, 125, 125, 0, 41, 123, 32, 2, 94, 63, 125, 123, 1, 0, 35, 1, 1, 125, 35, 1, 45, 125, 0, 125, 112, 90, 0, 0, 1, 0, 0, 0, 82, 32, 63, 0, 2, 125, 0, 0, 224, 187, 65, 0, 82, 125, 125, 0, 41, 123, 32, 2, 94, 31, 125, 123, 82, 29, 31, 0, 106, 125, 31, 96, 120, 125, 4, 0, 0, 71, 29, 0, 1, 0, 41, 1, 119, 0, 51, 0, 1, 125, 0, 0, 106, 123, 31, 88, 47, 125, 125, 123, 80, 39, 0, 0, 1, 28, 0, 0, 2, 125, 0, 0, 216, 187, 65, 0, 82, 125, 125, 0, 106, 123, 31, 12, 3, 123, 123, 28, 41, 123, 123, 2, 94, 21, 125, 123, 106, 125, 21, 56, 25, 123, 21, 56, 106, 123, 123, 4, 2, 120, 0, 0, 64, 66, 15, 0, 1, 121, 0, 0, 2, 127, 0, 0, 64, 66, 15, 0, 1, 124, 0, 0, 135, 17, 40, 0, 125, 123, 120, 121, 127, 124, 0, 0, 135, 22, 2, 0, 135, 30, 1, 0, 135, 27, 2, 0, 106, 124, 21, 40, 25, 127, 21, 40, 106, 127, 127, 4, 135, 19, 20, 0, 30, 27, 124, 127, 135, 21, 2, 0, 25, 28, 28, 1, 15, 127, 21, 22, 13, 124, 22, 21, 16, 121, 19, 17, 19, 124, 124, 121, 20, 127, 127, 124, 121, 127, 3, 0, 1, 0, 42, 1, 119, 0, 9, 0, 106, 127, 31, 88, 54, 127, 28, 127, 164, 38, 0, 0, 82, 71, 31, 0, 1, 0, 41, 1, 119, 0, 3, 0, 0, 71, 29, 0, 1, 0, 41, 1, 1, 127, 41, 1, 45, 127, 0, 127, 248, 89, 0, 0, 1, 0, 0, 0, 1, 127, 64, 22, 3, 127, 1, 127, 134, 28, 0, 0, 248, 22, 1, 0, 71, 127, 0, 0, 32, 127, 28, 245, 121, 127, 3, 0, 1, 0, 42, 1, 119, 0, 156, 12, 34, 127, 28, 0, 121, 127, 56, 2, 106, 127, 31, 16, 120, 127, 3, 0, 0, 72, 28, 0, 119, 0, 209, 1, 106, 19, 31, 88, 1, 127, 0, 0, 47, 127, 127, 19, 48, 40, 0, 0, 1, 17, 0, 0, 0, 21, 19, 0, 2, 127, 0, 0, 216, 187, 65, 0, 82, 127, 127, 0, 106, 124, 31, 12, 3, 124, 124, 17, 41, 124, 124, 2, 94, 19, 127, 124, 106, 22, 19, 20, 106, 127, 19, 16, 120, 127, 3, 0, 0, 73, 21, 0, 119, 0, 13, 0, 1, 127, 0, 0, 1, 121, 0, 0, 1, 120, 1, 0, 135, 124, 41, 0, 19, 121, 120, 0], eb + 0);
                HEAPU8.set([47, 127, 127, 124, 16, 40, 0, 0, 1, 74, 0, 0, 119, 0, 123, 12, 135, 127, 42, 0, 22, 0, 0, 0, 106, 73, 31, 88, 25, 17, 17, 1, 56, 127, 73, 17, 48, 40, 0, 0, 0, 21, 73, 0, 119, 0, 228, 255, 1, 127, 255, 255, 1, 124, 40, 4, 94, 124, 29, 124, 1, 120, 40, 4, 3, 120, 29, 120, 106, 120, 120, 4, 1, 121, 0, 0, 135, 21, 43, 0, 29, 127, 124, 120, 121, 0, 0, 0, 34, 121, 21, 0, 121, 121, 12, 0, 1, 120, 0, 0, 1, 124, 24, 0, 2, 127, 0, 0, 54, 100, 10, 0, 1, 123, 136, 24, 3, 123, 1, 123, 135, 121, 5, 0, 120, 124, 127, 123, 0, 75, 21, 0, 1, 0, 92, 1, 119, 0, 137, 1, 106, 17, 31, 88, 1, 121, 0, 0, 47, 121, 121, 17, 192, 45, 0, 0, 2, 121, 0, 0, 216, 187, 65, 0, 82, 22, 121, 0, 106, 19, 31, 12, 1, 27, 0, 0, 1, 30, 0, 0, 3, 121, 30, 19, 41, 121, 121, 2, 94, 35, 22, 121, 106, 121, 35, 20, 106, 121, 121, 8, 32, 121, 121, 1, 121, 121, 15, 0, 106, 123, 35, 120, 32, 123, 123, 0, 121, 123, 6, 0, 25, 123, 35, 120, 106, 123, 123, 4, 32, 123, 123, 0, 0, 121, 123, 0, 119, 0, 3, 0, 1, 123, 0, 0, 0, 121, 123, 0, 1, 123, 1, 0, 125, 76, 121, 27, 123, 0, 0, 0, 119, 0, 2, 0, 0, 76, 27, 0, 25, 30, 30, 1, 52, 123, 30, 17, 32, 41, 0, 0, 0, 27, 76, 0, 119, 0, 230, 255, 121, 76, 142, 0, 1, 27, 0, 0, 0, 30, 19, 0, 0, 35, 22, 0, 0, 33, 17, 0, 3, 123, 27, 30, 41, 123, 123, 2, 94, 18, 35, 123, 106, 6, 18, 20, 106, 123, 6, 8, 32, 123, 123, 1, 121, 123, 118, 0, 106, 20, 18, 120, 25, 123, 18, 120, 106, 23, 123, 4, 32, 123, 20, 0, 32, 121, 23, 0, 19, 123, 123, 121, 121, 123, 3, 0, 0, 77, 33, 0, 119, 0, 110, 0, 1, 121, 1, 0, 97, 1, 116, 121, 3, 121, 1, 116, 25, 16, 121, 4, 1, 121, 88, 1, 3, 121, 6, 121, 116, 16, 121, 0, 106, 121, 18, 4, 25, 3, 121, 16, 94, 123, 1, 116, 97, 1, 118, 123, 3, 123, 1, 118, 82, 121, 16, 0, 109, 123, 4, 121, 82, 123, 3, 0, 97, 1, 117, 123, 3, 123, 1, 117, 106, 121, 3, 4, 109, 123, 4, 121, 3, 121, 1, 118, 3, 123, 1, 117, 135, 3, 34, 0, 20, 23, 121, 123, 135, 23, 2, 0, 106, 20, 31, 24, 25, 123, 31, 24, 106, 16, 123, 4, 32, 123, 20, 0, 32, 121, 16, 0, 19, 123, 123, 121, 121, 123, 11, 0, 106, 123, 18, 4, 25, 14, 123, 16, 82, 2, 14, 0, 106, 11, 14, 4, 109, 31, 32, 2, 25, 123, 31, 32, 109, 123, 4, 11, 0, 78, 2, 0, 0, 79, 11, 0, 119, 0, 3, 0, 106, 78, 31, 32, 106, 79, 31, 36, 106, 123, 18, 104, 25, 121, 18, 104, 106, 121, 121, 4, 106, 127, 18, 96, 25, 124, 18, 96, 106, 124, 124, 4, 135, 11, 20, 0, 123, 121, 127, 124, 135, 124, 2, 0, 135, 2, 44, 0, 11, 124, 3, 23, 135, 23, 2, 0, 106, 3, 18, 4, 106, 11, 3, 16, 106, 14, 3, 20, 97, 1, 116, 78, 3, 124, 1, 116, 109, 124, 4, 79, 97, 1, 119, 11, 3, 124, 1, 119, 109, 124, 4, 14, 32, 124, 20, 0, 32, 127, 16, 0, 19, 124, 124, 127, 121, 124, 3, 0, 1, 0, 80, 1, 119, 0, 23, 0, 94, 127, 1, 116, 97, 1, 118, 127, 3, 127, 1, 118, 3, 124, 1, 116, 106, 124, 124, 4, 109, 127, 4, 124, 94, 127, 1, 119, 97, 1, 117, 127, 3, 127, 1, 117, 3, 124, 1, 119, 106, 124, 124, 4, 109, 127, 4, 124, 3, 127, 1, 118, 3, 121, 1, 117, 135, 124, 45, 0, 20, 16, 127, 2, 23, 121, 0, 0, 34, 124, 124, 0, 121, 124, 3, 0, 1, 0, 80, 1, 119, 0, 2, 0, 3, 80, 1, 116, 1, 124, 80, 1, 45, 124, 0, 124, 4, 43, 0, 0, 1, 0, 0, 0, 109, 31, 24, 2, 25, 124, 31, 24, 109, 124, 4, 23, 3, 80, 1, 119, 0, 23, 80, 0, 106, 2, 23, 4, 82, 121, 23, 0, 109, 31, 32, 121, 25, 121, 31, 32, 109, 121, 4, 2, 106, 77, 31, 88, 119, 0, 2, 0, 0, 77, 33, 0, 25, 18, 27, 1, 49, 121, 77, 18, 60, 43, 0, 0, 0, 81, 77, 0, 119, 0, 163, 0, 0, 27, 18, 0, 106, 30, 31, 12, 2, 121, 0, 0, 216, 187, 65, 0, 82, 35, 121, 0, 0, 33, 77, 0, 119, 0, 120, 255, 1, 33, 0, 0, 0, 35, 19, 0, 0, 30, 22, 0, 3, 121, 33, 35, 41, 121, 121, 2, 94, 27, 30, 121, 1, 121, 144, 0, 94, 18, 27, 121, 120, 18, 15, 0, 106, 6, 27, 4, 106, 2, 6, 68, 120, 2, 4, 0, 1, 82, 1, 0, 1, 83, 0, 0, 119, 0, 20, 0, 106, 124, 6, 72, 109, 1, 64, 124, 25, 124, 1, 64, 109, 124, 4, 2, 25, 84, 1, 64, 25, 85, 27, 4, 1, 0, 64, 1, 119, 0, 12, 0, 1, 124, 64, 1, 1, 121, 148, 0, 94, 121, 27, 121, 97, 1, 124, 121, 1, 121, 64, 1, 3, 121, 1, 121, 109, 121, 4, 18, 1, 121, 64, 1, 3, 84, 1, 121, 25, 85, 27, 4, 1, 0, 64, 1, 1, 121, 64, 1, 45, 121, 0, 121, 64, 44, 0, 0, 1, 0, 0, 0, 82, 121, 85, 0, 25, 18, 121, 16, 82, 124, 84, 0, 97, 1, 118, 124, 3, 124, 1, 118, 106, 121, 84, 4, 109, 124, 4, 121, 82, 124, 18, 0, 97, 1, 117, 124, 3, 124, 1, 117, 106, 121, 18, 4, 109, 124, 4, 121, 1, 121, 1, 0, 1, 124, 0, 0, 3, 127, 1, 118, 3, 123, 1, 117, 135, 18, 34, 0, 121, 124, 127, 123, 0, 82, 18, 0, 135, 83, 2, 0, 106, 18, 31, 24, 25, 123, 31, 24, 106, 2, 123, 4, 32, 123, 18, 0, 32, 127, 2, 0, 19, 123, 123, 127, 121, 123, 12, 0, 106, 123, 27, 4, 25, 6, 123, 16, 82, 23, 6, 0, 106, 16, 6, 4, 109, 31, 32, 23, 25, 123, 31, 32, 109, 123, 4, 16, 0, 86, 23, 0, 0, 87, 16, 0, 25, 88, 27, 4, 119, 0, 4, 0, 106, 86, 31, 32, 106, 87, 31, 36, 25, 88, 27, 4, 106, 123, 27, 104, 25, 127, 27, 104, 106, 127, 127, 4, 106, 124, 27, 96, 25, 121, 27, 96, 106, 121, 121, 4, 135, 16, 20, 0, 123, 127, 124, 121, 135, 121, 2, 0, 135, 23, 44, 0, 16, 121, 82, 83, 135, 16, 2, 0, 82, 6, 88, 0, 106, 20, 6, 16, 106, 14, 6, 20, 97, 1, 116, 86, 3, 121, 1, 116, 109, 121, 4, 87, 97, 1, 119, 20, 3, 121, 1, 119, 109, 121, 4, 14, 32, 121, 18, 0, 32, 124, 2, 0, 19, 121, 121, 124, 121, 121, 3, 0, 1, 0, 70, 1, 119, 0, 23, 0, 94, 124, 1, 116, 97, 1, 118, 124, 3, 124, 1, 118, 3, 121, 1, 116, 106, 121, 121, 4, 109, 124, 4, 121, 94, 124, 1, 119, 97, 1, 117, 124, 3, 124, 1, 117, 3, 121, 1, 119, 106, 121, 121, 4, 109, 124, 4, 121, 3, 124, 1, 118, 3, 127, 1, 117, 135, 121, 45, 0, 18, 2, 124, 23, 16, 127, 0, 0, 34, 121, 121, 0, 121, 121, 3, 0, 1, 0, 70, 1, 119, 0, 2, 0, 3, 89, 1, 116, 1, 121, 70, 1, 45, 121, 0, 121, 120, 45, 0, 0, 1, 0, 0, 0, 109, 31, 24, 23, 25, 121, 31, 24, 109, 121, 4, 16, 3, 89, 1, 119, 0, 16, 89, 0, 106, 23, 16, 4, 82, 127, 16, 0, 109, 31, 32, 127, 25, 127, 31, 32, 109, 127, 4, 23, 25, 23, 33, 1, 106, 16, 31, 88, 49, 127, 16, 23, 168, 45, 0, 0, 0, 81, 16, 0, 119, 0, 8, 0, 0, 33, 23, 0, 106, 35, 31, 12, 2, 127, 0, 0, 216, 187, 65, 0, 82, 30, 127, 0, 119, 0, 106, 255, 0, 81, 17, 0, 106, 17, 31, 16, 1, 127, 0, 0, 47, 127, 127, 17, 220, 45, 0, 0, 26, 121, 17, 1, 109, 31, 16, 121, 1, 121, 0, 0, 15, 121, 121, 81, 106, 127, 31, 96, 33, 127, 127, 0, 19, 121, 121, 127, 121, 121, 40, 0, 1, 17, 0, 0, 2, 121, 0, 0, 216, 187, 65, 0, 82, 121, 121, 0, 106, 127, 31, 12, 3, 127, 127, 17, 41, 127, 127, 2, 94, 30, 121, 127, 106, 121, 30, 56, 25, 127, 30, 56, 106, 127, 127, 4, 2, 124, 0, 0, 64, 66, 15, 0, 1, 123, 0, 0, 2, 120, 0, 0, 64, 66, 15, 0, 1, 125, 0, 0, 135, 35, 40, 0, 121, 127, 124, 123, 120, 125, 0, 0, 135, 33, 2, 0, 135, 22, 1, 0, 135, 19, 2, 0, 106, 125, 30, 40, 25, 120, 30, 40, 106, 120, 120, 4, 135, 23, 20, 0, 22, 19, 125, 120, 135, 30, 2, 0, 25, 17, 17, 1, 15, 120, 30, 33, 13, 125, 33, 30, 16, 123, 23, 35, 19, 125, 125, 123, 20, 120, 120, 125, 120, 120, 11, 0, 106, 120, 31, 88, 54, 120, 17, 120, 248, 45, 0, 0, 82, 120, 31, 0, 1, 125, 64, 22, 3, 125, 1, 125, 134, 75, 0, 0, 248, 22, 1, 0, 120, 125, 0, 0, 1, 0, 92, 1, 1, 125, 92, 1, 45, 125, 0, 125, 212, 46, 0, 0, 1, 0, 0, 0, 32, 125, 75, 245, 120, 125, 5, 0, 34, 125, 75, 0, 121, 125, 106, 0, 0, 72, 75, 0, 119, 0, 5, 0, 1, 120, 1, 0, 109, 31, 8, 120, 1, 74, 245, 255, 119, 0, 198, 10, 2, 120, 0, 0, 187, 176, 185, 223, 46, 120, 72, 120, 28, 47, 0, 0, 1, 125, 32, 4, 94, 125, 29, 125, 135, 120, 46, 0, 125, 72, 0, 0, 2, 120, 0, 0, 96, 187, 65, 0, 82, 120, 120, 0, 121, 120, 3, 0, 1, 0, 97, 1, 119, 0, 244, 10, 1, 120, 0, 0, 106, 125, 31, 88, 47, 120, 120, 125, 96, 48, 0, 0, 1, 21, 0, 0, 2, 120, 0, 0, 216, 187, 65, 0, 82, 120, 120, 0, 106, 125, 31, 12, 3, 125, 125, 21, 41, 125, 125, 2, 94, 17, 120, 125, 106, 120, 17, 16, 121, 120, 10, 0, 1, 120, 0, 0, 1, 123, 0, 0, 1, 124, 0, 0, 135, 125, 41, 0, 17, 123, 124, 0, 47, 120, 120, 125, 120, 47, 0, 0, 1, 74, 0, 0, 119, 0, 161, 10, 2, 120, 0, 0, 236, 187, 65, 0, 82, 17, 120, 0, 1, 120, 0, 0, 47, 120, 120, 17, 80, 48, 0, 0, 2, 120, 0, 0, 232, 187, 65, 0, 82, 23, 120, 0, 106, 120, 31, 12, 3, 35, 120, 21, 2, 120, 0, 0, 240, 187, 65, 0, 82, 30, 120, 0, 1, 33, 0, 0, 41, 120, 33, 2, 94, 19, 23, 120, 106, 120, 19, 8, 45, 120, 120, 35, 68, 48, 0, 0, 1, 120, 52, 1, 94, 120, 19, 120, 120, 120, 5, 0, 106, 120, 19, 88, 106, 120, 120, 8, 33, 120, 120, 3, 120, 120, 25, 0, 82, 120, 19, 0, 41, 120, 120, 2, 94, 22, 30, 120, 1, 120, 44, 1, 1, 125, 3, 0, 97, 19, 120, 125, 106, 125, 22, 40, 120, 125, 2, 0, 119, 0, 16, 0, 82, 125, 22, 0, 106, 16, 125, 24, 120, 16, 2, 0, 119, 0, 12, 0, 106, 2, 22, 8, 1, 22, 0, 0, 3, 125, 22, 2, 41, 125, 125, 2, 94, 125, 23, 125, 1, 120, 44, 1, 1, 124, 3, 0, 97, 125, 120, 124, 25, 22, 22, 1, 53, 124, 22, 16, 32, 48, 0, 0, 25, 33, 33, 1, 53, 124, 33, 17, 180, 47, 0, 0, 25, 21, 21, 1, 106, 124, 31, 88, 54, 124, 21, 124, 48, 47, 0, 0, 1, 120, 1, 0, 109, 31, 4, 120, 1, 74, 245, 255, 119, 0, 99, 10, 2, 120, 0, 0, 228, 187, 65, 0, 82, 28, 120, 0, 1, 120, 0, 0, 47, 120, 120, 28, 180, 48, 0, 0, 2, 120, 0, 0, 224, 187, 65, 0, 82, 21, 120, 0, 1, 17, 0, 0, 41, 120, 17, 2, 94, 120, 21, 120, 1, 124, 0, 0, 109, 120, 8, 124, 25, 17, 17, 1, 53, 124, 17, 28, 152, 48, 0, 0, 2, 124, 0, 0, 236, 187, 65, 0, 82, 28, 124, 0, 1, 124, 0, 0, 47, 124, 124, 28, 252, 48, 0, 0, 2, 124, 0, 0, 232, 187, 65, 0, 82, 17, 124, 0, 1, 21, 0, 0, 41, 124, 21, 2, 94, 124, 17, 124, 1, 120, 48, 1, 1, 125, 0, 0, 97, 124, 120, 125, 25, 21, 21, 1, 53, 125, 21, 28, 220, 48, 0, 0, 2, 125, 0, 0, 80, 187, 65, 0, 82, 125, 125, 0, 121, 125, 15, 0, 1, 120, 0, 0, 1, 124, 32, 0, 1, 123, 64, 22, 3, 123, 1, 123, 2, 127, 0, 0, 76, 187, 65, 0, 82, 127, 127, 0, 106, 121, 29, 28, 82, 122, 40, 0, 41, 122, 122, 2, 94, 121, 121, 122, 135, 125, 47, 0, 120, 124, 123, 127, 121, 0, 0, 0, 82, 28, 40, 0, 106, 125, 31, 88, 47, 125, 28, 125, 248, 87, 0, 0, 2, 125, 0, 0, 216, 187, 65, 0, 82, 125, 125, 0, 106, 121, 31, 12, 3, 121, 121, 28, 41, 121, 121, 2, 94, 21, 125, 121, 1, 125, 64, 22, 3, 125, 1, 125, 106, 17, 125, 28, 1, 125, 48, 1, 3, 125, 21, 125, 25, 33, 125, 4, 1, 125, 48, 1, 94, 125, 21, 125, 82, 121, 33, 0, 34, 127, 17, 0, 41, 127, 127, 31, 42, 127, 127, 31, 135, 23, 44, 0, 125, 121, 17, 127, 135, 17, 2, 0, 1, 127, 48, 1, 97, 21, 127, 23, 85, 33, 17, 0, 1, 127, 56, 1, 3, 127, 21, 127, 25, 17, 127, 4, 1, 127, 56, 1, 94, 127, 21, 127, 82, 121, 17, 0, 1, 125, 1, 0, 1, 123, 0, 0, 135, 33, 44, 0, 127, 121, 125, 123, 135, 23, 2, 0, 1, 123, 56, 1, 97, 21, 123, 33, 85, 17, 23, 0, 106, 123, 21, 8, 120, 123, 252, 9, 1, 123, 64, 22, 3, 123, 1, 123, 106, 123, 123, 36, 38, 123, 123, 2, 121, 123, 29, 0, 2, 123, 0, 0, 96, 187, 65, 0, 82, 123, 123, 0, 32, 123, 123, 0, 1, 125, 24, 0, 1, 121, 8, 0, 125, 23, 123, 125, 121, 0, 0, 0, 1, 121, 192, 24, 1, 125, 32, 4, 94, 125, 29, 125, 97, 1, 121, 125, 1, 125, 192, 24, 3, 125, 1, 125, 109, 125, 4, 28, 1, 121, 0, 0, 2, 123, 0, 0, 127, 100, 10, 0, 1, 127, 192, 24, 3, 127, 1, 127, 135, 125, 5, 0, 121, 23, 123, 127, 2, 125, 0, 0, 96, 187, 65, 0, 82, 125, 125, 0, 121, 125, 3, 0, 1, 0, 132, 1, 119, 0, 28, 10, 2, 125, 0, 0, 92, 187, 65, 0, 82, 125, 125, 0, 121, 125, 18, 2, 82, 125, 40, 0, 106, 127, 31, 12, 3, 23, 125, 127, 106, 127, 21, 20, 106, 127, 127, 8, 135, 17, 48, 0, 127, 0, 0, 0, 1, 127, 136, 29, 3, 24, 1, 127, 25, 25, 24, 32, 1, 127, 0, 0, 83, 24, 127, 0, 25, 24, 24, 1, 54, 127, 24, 25, 180, 50, 0, 0, 106, 33, 21, 48, 25, 127, 21, 48, 106, 30, 127, 4, 32, 127, 33, 0, 2, 125, 0, 0, 0, 0, 0, 128, 13, 125, 30, 125, 19, 127, 127, 125, 121, 127, 11, 0, 1, 125, 136, 29, 3, 125, 1, 125, 1, 123, 32, 0, 2, 121, 0, 0, 201, 107, 11, 0, 1, 124, 200, 24, 3, 124, 1, 124, 135, 127, 10, 0, 125, 123, 121, 124, 119, 0, 15, 0, 1, 127, 208, 24, 97, 1, 127, 33, 1, 127, 208, 24, 3, 127, 1, 127, 109, 127, 4, 30, 1, 124, 136, 29, 3, 124, 1, 124, 1, 121, 32, 0, 2, 123, 0, 0, 150, 27, 13, 0, 1, 125, 208, 24, 3, 125, 1, 125, 135, 127, 10, 0, 124, 121, 123, 125, 1, 127, 104, 29, 3, 24, 1, 127, 25, 25, 24, 32, 1, 127, 0, 0, 83, 24, 127, 0, 25, 24, 24, 1, 54, 127, 24, 25, 88, 51, 0, 0, 106, 30, 21, 48, 25, 127, 21, 48, 106, 33, 127, 4, 32, 127, 30, 0, 2, 125, 0, 0, 0, 0, 0, 128, 13, 125, 33, 125, 19, 127, 127, 125, 121, 127, 11, 0, 1, 125, 104, 29, 3, 125, 1, 125, 1, 123, 32, 0, 2, 121, 0, 0, 201, 107, 11, 0, 1, 124, 216, 24, 3, 124, 1, 124, 135, 127, 10, 0, 125, 123, 121, 124, 119, 0, 22, 0, 1, 127, 224, 24, 77, 124, 30, 0, 61, 121, 0, 0, 0, 0, 128, 79, 76, 123, 33, 0, 65, 121, 121, 123, 63, 124, 124, 121, 62, 121, 0, 0, 141, 237, 181, 160, 247, 198, 176, 62, 65, 124, 124, 121, 99, 1, 127, 124, 1, 127, 104, 29, 3, 127, 1, 127, 1, 121, 32, 0, 2, 123, 0, 0, 77, 100, 10, 0, 1, 125, 224, 24, 3, 125, 1, 125, 135, 124, 10, 0, 127, 121, 123, 125, 1, 124, 72, 29, 3, 24, 1, 124, 25, 25, 24, 32, 1, 124, 0, 0, 83, 24, 124, 0, 25, 24, 24, 1, 54, 124, 24, 25, 24, 52, 0, 0, 106, 33, 21, 64, 25, 124, 21, 64, 106, 30, 124, 4, 32, 124, 33, 0, 2, 125, 0, 0, 0, 0, 0, 128, 13, 125, 30, 125, 19, 124, 124, 125, 121, 124, 11, 0, 1, 125, 72, 29, 3, 125, 1, 125, 1, 123, 32, 0, 2, 121, 0, 0, 201, 107, 11, 0, 1, 127, 232, 24, 3, 127, 1, 127, 135, 124, 10, 0, 125, 123, 121, 127, 119, 0, 15, 0, 1, 124, 240, 24, 97, 1, 124, 33, 1, 124, 240, 24, 3, 124, 1, 124, 109, 124, 4, 30, 1, 127, 72, 29, 3, 127, 1, 127, 1, 121, 32, 0, 2, 123, 0, 0, 150, 27, 13, 0, 1, 125, 240, 24, 3, 125, 1, 125, 135, 124, 10, 0, 127, 121, 123, 125, 1, 124, 40, 29, 3, 24, 1, 124, 25, 25, 24, 32, 1, 124, 0, 0, 83, 24, 124, 0, 25, 24, 24, 1, 54, 124, 24, 25, 188, 52, 0, 0, 106, 30, 21, 64, 25, 124, 21, 64, 106, 33, 124, 4, 32, 124, 30, 0, 2, 125, 0, 0, 0, 0, 0, 128, 13, 125, 33, 125, 19, 124, 124, 125, 121, 124, 11, 0, 1, 125, 40, 29, 3, 125, 1, 125, 1, 123, 32, 0, 2, 121, 0, 0, 201, 107, 11, 0, 1, 127, 248, 24, 3, 127, 1, 127, 135, 124, 10, 0, 125, 123, 121, 127, 119, 0, 22, 0, 1, 124, 0, 25, 77, 127, 30, 0, 61, 121, 0, 0, 0, 0, 128, 79, 76, 123, 33, 0, 65, 121, 121, 123, 63, 127, 127, 121, 62, 121, 0, 0, 141, 237, 181, 160, 247, 198, 176, 62, 65, 127, 127, 121, 99, 1, 124, 127, 1, 124, 40, 29, 3, 124, 1, 124, 1, 121, 32, 0, 2, 123, 0, 0, 77, 100, 10, 0, 1, 125, 0, 25, 3, 125, 1, 125, 135, 127, 10, 0, 124, 121, 123, 125, 1, 127, 8, 29, 3, 24, 1, 127, 25, 25, 24, 32, 1, 127, 0, 0, 83, 24, 127, 0, 25, 24, 24, 1, 54, 127, 24, 25, 124, 53, 0, 0, 82, 33, 37, 0, 106, 30, 37, 4, 32, 127, 33, 0, 2, 125, 0, 0, 0, 0, 0, 128, 13, 125, 30, 125, 19, 127, 127, 125, 121, 127, 11, 0, 1, 125, 8, 29, 3, 125, 1, 125, 1, 123, 32, 0, 2, 121, 0, 0, 201, 107, 11, 0, 1, 124, 8, 25, 3, 124, 1, 124, 135, 127, 10, 0, 125, 123, 121, 124, 119, 0, 15, 0, 1, 127, 16, 25, 97, 1, 127, 33, 1, 127, 16, 25, 3, 127, 1, 127, 109, 127, 4, 30, 1, 124, 8, 29, 3, 124, 1, 124, 1, 121, 32, 0, 2, 123, 0, 0, 150, 27, 13, 0, 1, 125, 16, 25, 3, 125, 1, 125, 135, 127, 10, 0, 124, 121, 123, 125, 1, 127, 232, 28, 3, 24, 1, 127, 25, 25, 24, 32, 1, 127, 0, 0, 83, 24, 127, 0, 25, 24, 24, 1, 54, 127, 24, 25, 28, 54, 0, 0, 82, 30, 37, 0, 106, 33, 37, 4, 106, 35, 21, 4, 32, 127, 30, 0, 2, 125, 0, 0, 0, 0, 0, 128, 13, 125, 33, 125, 19, 127, 127, 125, 121, 127, 11, 0, 1, 125, 232, 28, 3, 125, 1, 125, 1, 123, 32, 0, 2, 121, 0, 0, 201, 107, 11, 0, 1, 124, 24, 25, 3, 124, 1, 124, 135, 127, 10, 0, 125, 123, 121, 124, 119, 0, 24, 0, 1, 127, 32, 25, 106, 124, 35, 16, 76, 124, 124, 0, 106, 121, 35, 20, 76, 121, 121, 0, 66, 124, 124, 121, 77, 121, 30, 0, 61, 123, 0, 0, 0, 0, 128, 79, 76, 125, 33, 0, 65, 123, 123, 125, 63, 121, 121, 123, 65, 124, 124, 121, 99, 1, 127, 124, 1, 127, 232, 28, 3, 127, 1, 127, 1, 121, 32, 0, 2, 123, 0, 0, 77, 100, 10, 0, 1, 125, 32, 25, 3, 125, 1, 125, 135, 124, 10, 0, 127, 121, 123, 125, 1, 124, 200, 28, 3, 24, 1, 124, 25, 25, 24, 32, 1, 124, 0, 0, 83, 24, 124, 0, 25, 24, 24, 1, 54, 124, 24, 25, 228, 54, 0, 0, 82, 33, 36, 0, 106, 30, 36, 4, 32, 124, 33, 0, 2, 125, 0, 0, 0, 0, 0, 128, 13, 125, 30, 125, 19, 124, 124, 125, 121, 124, 11, 0, 1, 125, 200, 28, 3, 125, 1, 125, 1, 123, 32, 0, 2, 121, 0, 0, 201, 107, 11, 0, 1, 127, 40, 25, 3, 127, 1, 127, 135, 124, 10, 0, 125, 123, 121, 127, 119, 0, 15, 0, 1, 124, 48, 25, 97, 1, 124, 33, 1, 124, 48, 25, 3, 124, 1, 124, 109, 124, 4, 30, 1, 127, 200, 28, 3, 127, 1, 127, 1, 121, 32, 0, 2, 123, 0, 0, 150, 27, 13, 0, 1, 125, 48, 25, 3, 125, 1, 125, 135, 124, 10, 0, 127, 121, 123, 125, 1, 124, 168, 28, 3, 24, 1, 124, 25, 25, 24, 32, 1, 124, 0, 0, 83, 24, 124, 0, 25, 24, 24, 1, 54, 124, 24, 25, 132, 55, 0, 0, 82, 30, 36, 0, 106, 33, 36, 4, 106, 35, 21, 4, 32, 124, 30, 0, 2, 125, 0, 0, 0, 0, 0, 128, 13, 125, 33, 125, 19, 124, 124, 125, 121, 124, 11, 0, 1, 125, 168, 28, 3, 125, 1, 125, 1, 123, 32, 0, 2, 121, 0, 0, 201, 107, 11, 0, 1, 127, 56, 25, 3, 127, 1, 127, 135, 124, 10, 0, 125, 123, 121, 127, 119, 0, 24, 0, 1, 124, 64, 25, 106, 127, 35, 16, 76, 127, 127, 0, 106, 121, 35, 20, 76, 121, 121, 0, 66, 127, 127, 121, 77, 121, 30, 0, 61, 123, 0, 0, 0, 0, 128, 79, 76, 125, 33, 0, 65, 123, 123, 125, 63, 121, 121, 123, 65, 127, 127, 121, 99, 1, 124, 127, 1, 124, 168, 28, 3, 124, 1, 124, 1, 121, 32, 0, 2, 123, 0, 0, 77, 100, 10, 0, 1, 125, 64, 25, 3, 125, 1, 125, 135, 127, 10, 0, 124, 121, 123, 125, 1, 127, 136, 28, 3, 24, 1, 127, 25, 25, 24, 32, 1, 127, 0, 0, 83, 24, 127, 0, 25, 24, 24, 1, 54, 127, 24, 25, 76, 56, 0, 0, 2, 127, 0, 0, 224, 187, 65, 0, 82, 127, 127, 0, 82, 125, 21, 0, 41, 125, 125, 2, 94, 127, 127, 125, 25, 33, 127, 48, 82, 30, 33, 0, 106, 35, 33, 4, 32, 127, 30, 0, 2, 125, 0, 0, 0, 0, 0, 128, 13, 125, 35, 125, 19, 127, 127, 125, 121, 127, 11, 0, 1, 125, 136, 28, 3, 125, 1, 125, 1, 123, 32, 0, 2, 121, 0, 0, 201, 107, 11, 0, 1, 124, 72, 25, 3, 124, 1, 124, 135, 127, 10, 0, 125, 123, 121, 124, 119, 0, 15, 0, 1, 127, 80, 25, 97, 1, 127, 30, 1, 127, 80, 25, 3, 127, 1, 127, 109, 127, 4, 35, 1, 124, 136, 28, 3, 124, 1, 124, 1, 121, 32, 0, 2, 123, 0, 0, 150, 27, 13, 0, 1, 125, 80, 25, 3, 125, 1, 125, 135, 127, 10, 0, 124, 121, 123, 125, 1, 127, 104, 28, 3, 24, 1, 127, 25, 25, 24, 32, 1, 127, 0, 0, 83, 24, 127, 0, 25, 24, 24, 1, 54, 127, 24, 25, 8, 57, 0, 0, 2, 127, 0, 0, 224, 187, 65, 0, 82, 127, 127, 0, 82, 125, 21, 0, 41, 125, 125, 2, 94, 127, 127, 125, 25, 35, 127, 48, 82, 30, 35, 0, 106, 33, 35, 4, 32, 127, 30, 0, 2, 125, 0, 0, 0, 0, 0, 128, 13, 125, 33, 125, 19, 127, 127, 125, 121, 127, 11, 0, 1, 125, 104, 28, 3, 125, 1, 125, 1, 123, 32, 0, 2, 121, 0, 0, 201, 107, 11, 0, 1, 124, 88, 25, 3, 124, 1, 124, 135, 127, 10, 0, 125, 123, 121, 124, 119, 0, 22, 0, 1, 127, 96, 25, 77, 124, 30, 0, 61, 121, 0, 0, 0, 0, 128, 79, 76, 123, 33, 0, 65, 121, 121, 123, 63, 124, 124, 121, 62, 121, 0, 0, 141, 237, 181, 160, 247, 198, 176, 62, 65, 124, 124, 121, 99, 1, 127, 124, 1, 127, 104, 28, 3, 127, 1, 127, 1, 121, 32, 0, 2, 123, 0, 0, 77, 100, 10, 0, 1, 125, 96, 25, 3, 125, 1, 125, 135, 124, 10, 0, 127, 121, 123, 125, 1, 124, 104, 25, 97, 1, 124, 23, 1, 124, 104, 25, 3, 124, 1, 124, 109, 124, 4, 17, 1, 124, 104, 25, 3, 124, 1, 124, 1, 125, 136, 29, 3, 125, 1, 125, 109, 124, 8, 125, 1, 125, 104, 25, 3, 125, 1, 125, 1, 124, 104, 29, 3, 124, 1, 124, 109, 125, 12, 124, 1, 124, 104, 25, 3, 124, 1, 124, 1, 125, 72, 29, 3, 125, 1, 125, 109, 124, 16, 125, 1, 125, 104, 25, 3, 125, 1, 125, 1, 124, 40, 29, 3, 124, 1, 124, 109, 125, 20, 124, 1, 124, 104, 25, 3, 124, 1, 124, 1, 125, 8, 29, 3, 125, 1, 125, 109, 124, 24, 125, 1, 125, 104, 25, 3, 125, 1, 125, 1, 124, 232, 28, 3, 124, 1, 124, 109, 125, 28, 124, 1, 124, 104, 25, 3, 124, 1, 124, 1, 125, 200, 28, 3, 125, 1, 125, 109, 124, 32, 125, 1, 125, 104, 25, 3, 125, 1, 125, 1, 124, 168, 28, 3, 124, 1, 124, 109, 125, 36, 124, 1, 124, 104, 25, 3, 124, 1, 124, 1, 125, 136, 28, 3, 125, 1, 125, 109, 124, 40, 125, 1, 125, 104, 25, 3, 125, 1, 125, 1, 124, 104, 28, 3, 124, 1, 124, 109, 125, 44, 124, 1, 125, 0, 0, 1, 123, 32, 0, 2, 121, 0, 0, 166, 100, 10, 0, 1, 127, 104, 25, 3, 127, 1, 127, 135, 124, 5, 0, 125, 123, 121, 127, 106, 124, 21, 80, 120, 124, 59, 1, 1, 124, 40, 4, 94, 33, 29, 124, 1, 124, 40, 4, 3, 124, 29, 124, 106, 30, 124, 4, 32, 124, 33, 0, 2, 127, 0, 0, 0, 0, 0, 128, 13, 127, 30, 127, 19, 124, 124, 127, 120, 124, 48, 1, 1, 124, 64, 0, 106, 127, 21, 4, 1, 121, 184, 0, 94, 127, 127, 121, 56, 124, 124, 127, 192, 63, 0, 0, 106, 127, 21, 48, 32, 127, 127, 0, 121, 127, 8, 0, 25, 127, 21, 48, 106, 127, 127, 4, 2, 121, 0, 0, 0, 0, 0, 128, 13, 127, 127, 121, 0, 124, 127, 0, 119, 0, 3, 0, 1, 127, 0, 0, 0, 124, 127, 0, 121, 124, 174, 0, 106, 35, 31, 48, 25, 124, 31, 48, 106, 19, 124, 4, 1, 124, 0, 0, 1, 127, 0, 0, 135, 16, 20, 0, 124, 127, 33, 30, 13, 127, 35, 16, 135, 124, 2, 0, 13, 124, 19, 124, 19, 127, 127, 124, 120, 127, 4, 0, 0, 90, 33, 0, 0, 91, 30, 0, 119, 0, 161, 0, 106, 127, 29, 4, 106, 127, 127, 8, 1, 124, 0, 2, 19, 127, 127, 124, 120, 127, 4, 0, 0, 90, 33, 0, 0, 91, 30, 0, 119, 0, 153, 0, 106, 127, 29, 24, 120, 127, 7, 0, 2, 92, 0, 0, 255, 255, 255, 127, 0, 93, 30, 0, 1, 94, 255, 255, 0, 95, 33, 0, 119, 0, 105, 0, 1, 19, 0, 0, 2, 16, 0, 0, 255, 255, 255, 127, 1, 35, 255, 255, 106, 127, 29, 28, 41, 124, 19, 2, 94, 22, 127, 124, 106, 127, 22, 52, 32, 127, 127, 48, 121, 127, 4, 0, 0, 96, 35, 0, 0, 97, 16, 0, 119, 0, 78, 0, 106, 2, 22, 24, 25, 127, 22, 24, 106, 18, 127, 4, 32, 127, 2, 0, 2, 124, 0, 0, 0, 0, 0, 128, 13, 124, 18, 124, 19, 127, 127, 124, 121, 127, 4, 0, 0, 96, 35, 0, 0, 97, 16, 0, 119, 0, 66, 0, 1, 127, 160, 27, 1, 124, 1, 0, 97, 1, 127, 124, 1, 124, 160, 27, 3, 124, 1, 124, 25, 14, 124, 4, 2, 124, 0, 0, 64, 66, 15, 0, 85, 14, 124, 0, 106, 127, 22, 16, 97, 1, 118, 127, 3, 127, 1, 118, 25, 124, 22, 16, 106, 124, 124, 4, 109, 127, 4, 124, 1, 127, 160, 27, 94, 127, 1, 127, 97, 1, 117, 127, 3, 127, 1, 117, 82, 124, 14, 0, 109, 127, 4, 124, 3, 124, 1, 118, 3, 127, 1, 117, 135, 14, 34, 0, 2, 18, 124, 127, 135, 18, 2, 0, 15, 127, 18, 16, 13, 124, 16, 18, 16, 121, 14, 35, 19, 124, 124, 121, 20, 127, 127, 124, 120, 127, 4, 0, 0, 96, 35, 0, 0, 97, 16, 0, 119, 0, 31, 0, 106, 14, 22, 24, 25, 127, 22, 24, 106, 18, 127, 4, 1, 127, 152, 27, 1, 124, 1, 0, 97, 1, 127, 124, 1, 124, 152, 27, 3, 124, 1, 124, 25, 2, 124, 4, 2, 124, 0, 0, 64, 66, 15, 0, 85, 2, 124, 0, 106, 127, 22, 16, 97, 1, 118, 127, 3, 127, 1, 118, 25, 124, 22, 16, 106, 124, 124, 4, 109, 127, 4, 124, 1, 127, 152, 27, 94, 127, 1, 127, 97, 1, 117, 127, 3, 127, 1, 117, 82, 124, 2, 0, 109, 127, 4, 124, 3, 124, 1, 118, 3, 127, 1, 117, 135, 2, 34, 0, 14, 18, 124, 127, 0, 96, 2, 0, 135, 97, 2, 0, 25, 19, 19, 1, 106, 127, 29, 24, 57, 127, 127, 19, 80, 61, 0, 0, 0, 16, 97, 0, 0, 35, 96, 0, 119, 0, 164, 255, 0, 92, 97, 0, 1, 127, 40, 4, 3, 127, 29, 127, 106, 93, 127, 4, 0, 94, 96, 0, 1, 127, 40, 4, 94, 95, 29, 127, 15, 127, 93, 92, 13, 124, 92, 93, 16, 121, 95, 94, 19, 124, 124, 121, 20, 127, 127, 124, 120, 127, 4, 0, 0, 90, 95, 0, 0, 91, 93, 0, 119, 0, 32, 0, 1, 127, 0, 0, 1, 124, 0, 0, 135, 35, 20, 0, 127, 124, 94, 92, 135, 16, 2, 0, 135, 19, 20, 0, 94, 92, 95, 93, 135, 22, 2, 0, 1, 124, 152, 25, 97, 1, 124, 19, 1, 124, 152, 25, 3, 124, 1, 124, 109, 124, 4, 22, 1, 127, 40, 0, 2, 121, 0, 0, 74, 101, 10, 0, 1, 123, 152, 25, 3, 123, 1, 123, 135, 124, 5, 0, 29, 127, 121, 123, 109, 31, 48, 35, 25, 124, 31, 48, 109, 124, 4, 16, 1, 124, 40, 4, 94, 90, 29, 124, 1, 124, 40, 4, 3, 124, 29, 124, 106, 91, 124, 4, 119, 0, 3, 0, 0, 90, 33, 0, 0, 91, 30, 0, 1, 124, 144, 27, 1, 123, 1, 0, 97, 1, 124, 123, 1, 123, 144, 27, 3, 123, 1, 123, 25, 30, 123, 4, 2, 123, 0, 0, 64, 66, 15, 0, 85, 30, 123, 0, 106, 123, 21, 4, 25, 33, 123, 16, 1, 124, 144, 27, 94, 124, 1, 124, 97, 1, 118, 124, 3, 124, 1, 118, 82, 123, 30, 0, 109, 124, 4, 123, 82, 124, 33, 0, 97, 1, 117, 124, 3, 124, 1, 117, 106, 123, 33, 4, 109, 124, 4, 123, 3, 123, 1, 118, 3, 124, 1, 117, 135, 33, 34, 0, 90, 91, 123, 124, 135, 30, 2, 0, 106, 124, 21, 4, 1, 123, 184, 0, 94, 16, 124, 123, 1, 124, 1, 0, 1, 123, 0, 0, 135, 35, 49, 0, 124, 123, 16, 0, 135, 22, 2, 0, 135, 19, 44, 0, 35, 22, 33, 30, 135, 2, 2, 0, 1, 124, 1, 0, 109, 21, 80, 124, 15, 124, 30, 2, 13, 123, 2, 30, 16, 121, 33, 19, 19, 123, 123, 121, 20, 124, 124, 123, 120, 124, 2, 0, 119, 0, 63, 0, 82, 19, 36, 0, 106, 2, 36, 4, 32, 124, 19, 0, 2, 123, 0, 0, 0, 0, 0, 128, 13, 123, 2, 123, 19, 124, 124, 123, 120, 124, 24, 0, 1, 124, 1, 0, 1, 123, 0, 0, 26, 121, 16, 1, 135, 18, 49, 0, 124, 123, 121, 0, 135, 121, 2, 0, 135, 14, 44, 0, 18, 121, 33, 30, 135, 18, 2, 0, 15, 121, 18, 2, 13, 123, 2, 18, 16, 124, 14, 19, 19, 123, 123, 124, 20, 121, 121, 123, 120, 121, 2, 0, 119, 0, 8, 0, 135, 14, 20, 0, 19, 2, 35, 22, 135, 18, 2, 0, 85, 36, 14, 0, 109, 36, 4, 18, 1, 123, 0, 0, 109, 21, 80, 123, 82, 2, 37, 0, 106, 19, 37, 4, 32, 123, 2, 0, 2, 121, 0, 0, 0, 0, 0, 128, 13, 121, 19, 121, 19, 123, 123, 121, 120, 123, 24, 0, 1, 123, 1, 0, 1, 121, 0, 0, 26, 124, 16, 1, 135, 18, 49, 0, 123, 121, 124, 0, 135, 124, 2, 0, 135, 14, 44, 0, 18, 124, 33, 30, 135, 18, 2, 0, 15, 124, 18, 19, 13, 121, 19, 18, 16, 123, 14, 2, 19, 121, 121, 123, 20, 124, 124, 121, 120, 124, 2, 0, 119, 0, 8, 0, 135, 14, 20, 0, 2, 19, 35, 22, 135, 19, 2, 0, 85, 37, 14, 0, 109, 37, 4, 19, 1, 121, 0, 0, 109, 21, 80, 121, 1, 124, 56, 1, 94, 124, 21, 124, 32, 124, 124, 1, 121, 124, 7, 0, 1, 124, 56, 1, 3, 124, 21, 124, 106, 124, 124, 4, 32, 124, 124, 0, 0, 121, 124, 0, 119, 0, 3, 0, 1, 124, 0, 0, 0, 121, 124, 0, 121, 121, 45, 0, 106, 17, 21, 4, 1, 121, 156, 0, 94, 121, 17, 121, 36, 121, 121, 0, 120, 121, 40, 0, 1, 23, 0, 0, 0, 19, 17, 0, 1, 121, 152, 0, 94, 17, 19, 121, 27, 121, 23, 12, 3, 121, 17, 121, 25, 14, 121, 8, 82, 2, 14, 0, 33, 121, 2, 5, 121, 121, 24, 0, 1, 124, 64, 22, 3, 124, 1, 124, 1, 123, 0, 0, 135, 121, 50, 0, 124, 2, 123, 0, 120, 121, 18, 0, 27, 121, 23, 12, 3, 121, 17, 121, 25, 18, 121, 4, 1, 121, 64, 22, 3, 121, 1, 121, 82, 123, 14, 0, 82, 124, 18, 0, 135, 20, 51, 0, 121, 123, 124, 0, 120, 20, 3, 0, 1, 0, 194, 1, 119, 0, 157, 6, 27, 123, 23, 12, 94, 123, 17, 123, 82, 121, 18, 0, 135, 124, 52, 0, 20, 123, 121, 0, 25, 23, 23, 1, 106, 19, 21, 4, 1, 124, 156, 0, 94, 124, 19, 124, 54, 124, 23, 124, 16, 64, 0, 0, 82, 121, 36, 0, 32, 121, 121, 0, 121, 121, 7, 0, 106, 121, 36, 4, 2, 123, 0, 0, 0, 0, 0, 128, 13, 121, 121, 123, 0, 124, 121, 0, 119, 0, 3, 0, 1, 121, 0, 0, 0, 124, 121, 0, 120, 124, 38, 0, 106, 19, 31, 48, 25, 124, 31, 48, 106, 23, 124, 4, 1, 124, 136, 27, 1, 121, 1, 0, 97, 1, 124, 121, 1, 121, 136, 27, 3, 121, 1, 121, 25, 22, 121, 4, 2, 121, 0, 0, 64, 66, 15, 0, 85, 22, 121, 0, 106, 121, 21, 4, 25, 35, 121, 16, 1, 124, 136, 27, 94, 124, 1, 124, 97, 1, 118, 124, 3, 124, 1, 118, 82, 121, 22, 0, 109, 124, 4, 121, 82, 124, 35, 0, 97, 1, 117, 124, 3, 124, 1, 117, 106, 121, 35, 4, 109, 124, 4, 121, 3, 121, 1, 118, 3, 124, 1, 117, 135, 35, 34, 0, 19, 23, 121, 124, 135, 23, 2, 0, 82, 124, 36, 0, 106, 121, 36, 4, 135, 19, 44, 0, 124, 121, 35, 23, 135, 23, 2, 0, 85, 36, 19, 0, 109, 36, 4, 23, 82, 124, 37, 0, 32, 124, 124, 0, 121, 124, 7, 0, 106, 124, 37, 4, 2, 123, 0, 0, 0, 0, 0, 128, 13, 124, 124, 123, 0, 121, 124, 0, 119, 0, 3, 0, 1, 124, 0, 0, 0, 121, 124, 0, 120, 121, 92, 0, 106, 23, 31, 48, 25, 121, 31, 48, 106, 19, 121, 4, 1, 121, 128, 27, 1, 124, 1, 0, 97, 1, 121, 124, 1, 124, 128, 27, 3, 124, 1, 124, 25, 35, 124, 4, 2, 124, 0, 0, 64, 66, 15, 0, 85, 35, 124, 0, 106, 124, 21, 4, 25, 22, 124, 16, 1, 121, 128, 27, 94, 121, 1, 121, 97, 1, 118, 121, 3, 121, 1, 118, 82, 124, 35, 0, 109, 121, 4, 124, 82, 121, 22, 0, 97, 1, 117, 121, 3, 121, 1, 117, 106, 124, 22, 4, 109, 121, 4, 124, 3, 124, 1, 118, 3, 121, 1, 117, 135, 22, 34, 0, 23, 19, 124, 121, 135, 19, 2, 0, 82, 121, 37, 0, 106, 124, 37, 4, 135, 23, 44, 0, 121, 124, 22, 19, 135, 19, 2, 0, 85, 37, 23, 0, 109, 37, 4, 19, 32, 124, 23, 0, 2, 121, 0, 0, 0, 0, 0, 128, 13, 121, 19, 121, 19, 124, 124, 121, 120, 124, 49, 0, 1, 124, 128, 0, 98, 124, 21, 124, 77, 121, 23, 0, 61, 123, 0, 0, 0, 0, 128, 79, 76, 127, 19, 0, 65, 123, 123, 127, 63, 121, 121, 123, 65, 45, 124, 121, 135, 124, 53, 0, 45, 0, 0, 0, 59, 123, 1, 0, 74, 124, 124, 123, 121, 124, 29, 0, 59, 123, 0, 0, 73, 123, 45, 123, 121, 123, 14, 0, 61, 125, 0, 0, 0, 0, 128, 79, 66, 125, 45, 125, 135, 127, 54, 0, 125, 0, 0, 0, 62, 125, 0, 0, 0, 0, 224, 255, 255, 255, 239, 65, 135, 123, 55, 0, 127, 125, 0, 0, 75, 123, 123, 0, 0, 124, 123, 0, 119, 0, 11, 0, 75, 125, 45, 0, 77, 125, 125, 0, 64, 125, 45, 125, 61, 127, 0, 0, 0, 0, 128, 79, 66, 125, 125, 127, 135, 123, 56, 0, 125, 0, 0, 0, 75, 123, 123, 0, 0, 124, 123, 0, 0, 121, 124, 0, 119, 0, 3, 0, 1, 124, 0, 0, 0, 121, 124, 0, 0, 19, 121, 0, 75, 121, 45, 0, 85, 37, 121, 0, 109, 37, 4, 19, 82, 19, 36, 0, 106, 23, 36, 4, 32, 121, 19, 0, 2, 124, 0, 0, 0, 0, 0, 128, 13, 124, 23, 124, 19, 121, 121, 124, 121, 121, 5, 0, 1, 98, 0, 0, 2, 99, 0, 0, 0, 0, 0, 128, 119, 0, 51, 0, 1, 121, 128, 0, 98, 121, 21, 121, 77, 124, 19, 0, 61, 123, 0, 0, 0, 0, 128, 79, 76, 125, 23, 0, 65, 123, 123, 125, 63, 124, 124, 123, 65, 45, 121, 124, 135, 121, 53, 0, 45, 0, 0, 0, 59, 123, 1, 0, 74, 121, 121, 123, 121, 121, 29, 0, 59, 123, 0, 0, 73, 123, 45, 123, 121, 123, 14, 0, 61, 127, 0, 0, 0, 0, 128, 79, 66, 127, 45, 127, 135, 125, 54, 0, 127, 0, 0, 0, 62, 127, 0, 0, 0, 0, 224, 255, 255, 255, 239, 65, 135, 123, 55, 0, 125, 127, 0, 0, 75, 123, 123, 0, 0, 121, 123, 0, 119, 0, 11, 0, 75, 127, 45, 0, 77, 127, 127, 0, 64, 127, 45, 127, 61, 125, 0, 0, 0, 0, 128, 79, 66, 127, 127, 125, 135, 123, 56, 0, 127, 0, 0, 0, 75, 123, 123, 0, 0, 121, 123, 0, 0, 124, 121, 0, 119, 0, 3, 0, 1, 121, 0, 0, 0, 124, 121, 0, 0, 23, 124, 0, 75, 124, 45, 0, 85, 36, 124, 0, 109, 36, 4, 23, 75, 98, 45, 0, 0, 99, 23, 0, 106, 124, 21, 4, 25, 23, 124, 16, 1, 124, 120, 27, 1, 121, 1, 0, 97, 1, 124, 121, 1, 121, 120, 27, 3, 121, 1, 121, 25, 19, 121, 4, 2, 121, 0, 0, 64, 66, 15, 0, 85, 19, 121, 0, 82, 124, 23, 0, 97, 1, 118, 124, 3, 124, 1, 118, 106, 121, 23, 4, 109, 124, 4, 121, 1, 124, 120, 27, 94, 124, 1, 124, 97, 1, 117, 124, 3, 124, 1, 117, 82, 121, 19, 0, 109, 124, 4, 121, 3, 121, 1, 118, 3, 124, 1, 117, 1, 123, 5, 32, 135, 19, 57, 0, 98, 99, 121, 124, 123, 0, 0, 0, 135, 23, 2, 0, 106, 123, 21, 20, 106, 22, 123, 8, 120, 22, 9, 0, 32, 123, 19, 0, 2, 124, 0, 0, 0, 0, 0, 128, 13, 124, 23, 124, 19, 123, 123, 124, 120, 123, 12, 0, 1, 0, 207, 1, 119, 0, 10, 0, 33, 123, 19, 0, 2, 124, 0, 0, 0, 0, 0, 128, 14, 124, 23, 124, 20, 123, 123, 124, 32, 124, 22, 1, 19, 123, 123, 124, 121, 123, 2, 0, 1, 0, 207, 1, 1, 123, 207, 1, 45, 123, 0, 123, 124, 71, 0, 0, 1, 0, 0, 0, 2, 124, 0, 0, 84, 187, 65, 0, 82, 124, 124, 0, 121, 124, 4, 0, 1, 124, 1, 0, 0, 123, 124, 0, 119, 0, 13, 0, 106, 121, 21, 48, 121, 121, 4, 0, 1, 121, 1, 0, 0, 124, 121, 0, 119, 0, 7, 0, 25, 121, 21, 48, 106, 121, 121, 4, 2, 127, 0, 0, 0, 0, 0, 128, 14, 121, 121, 127, 0, 124, 121, 0, 0, 123, 124, 0, 120, 123, 152, 0, 106, 123, 29, 4, 106, 123, 123, 8, 1, 124, 0, 2, 19, 123, 123, 124, 120, 123, 2, 0, 119, 0, 146, 0, 106, 22, 31, 56, 25, 123, 31, 56, 106, 35, 123, 4, 32, 123, 22, 0, 2, 124, 0, 0, 0, 0, 0, 128, 13, 124, 35, 124, 19, 123, 123, 124, 120, 123, 137, 0, 135, 30, 20, 0, 19, 23, 22, 35, 135, 35, 2, 0, 77, 123, 30, 0, 61, 124, 0, 0, 0, 0, 128, 79, 76, 121, 35, 0, 65, 124, 124, 121, 63, 100, 123, 124, 145, 100, 100, 0, 2, 124, 0, 0, 124, 117, 9, 0, 88, 101, 124, 0, 145, 101, 101, 0, 60, 123, 0, 0, 192, 189, 240, 255, 145, 123, 123, 0, 65, 124, 101, 123, 145, 124, 124, 0, 73, 124, 124, 100, 60, 121, 0, 0, 64, 66, 15, 0, 145, 121, 121, 0, 65, 123, 101, 121, 145, 123, 123, 0, 71, 123, 123, 100, 20, 124, 124, 123, 120, 124, 2, 0, 119, 0, 108, 0, 25, 124, 31, 48, 25, 22, 124, 4, 106, 124, 31, 48, 82, 123, 22, 0, 135, 33, 20, 0, 124, 123, 30, 35, 135, 16, 2, 0, 109, 31, 48, 33, 85, 22, 16, 0, 1, 123, 160, 25, 97, 1, 123, 30, 1, 123, 160, 25, 3, 123, 1, 123, 109, 123, 4, 35, 1, 123, 160, 25, 3, 123, 1, 123, 25, 22, 123, 8, 85, 22, 33, 0, 109, 22, 4, 16, 1, 124, 0, 0, 1, 121, 48, 0, 2, 127, 0, 0, 105, 101, 10, 0, 1, 125, 160, 25, 3, 125, 1, 125, 135, 123, 5, 0, 124, 121, 127, 125, 1, 123, 112, 27, 1, 125, 1, 0, 97, 1, 123, 125, 1, 125, 112, 27, 3, 125, 1, 125, 25, 16, 125, 4, 2, 125, 0, 0, 64, 66, 15, 0, 85, 16, 125, 0, 106, 125, 21, 4, 25, 22, 125, 16, 1, 123, 112, 27, 94, 123, 1, 123, 97, 1, 118, 123, 3, 123, 1, 118, 82, 125, 16, 0, 109, 123, 4, 125, 82, 123, 22, 0, 97, 1, 117, 123, 3, 123, 1, 117, 106, 125, 22, 4, 109, 123, 4, 125, 3, 125, 1, 118, 3, 123, 1, 117, 135, 22, 34, 0, 30, 35, 125, 123, 135, 16, 2, 0, 82, 123, 36, 0, 106, 125, 36, 4, 135, 33, 20, 0, 123, 125, 22, 16, 135, 16, 2, 0, 85, 36, 33, 0, 109, 36, 4, 16, 82, 123, 37, 0, 32, 123, 123, 0, 121, 123, 7, 0, 106, 123, 37, 4, 2, 127, 0, 0, 0, 0, 0, 128, 13, 123, 123, 127, 0, 125, 123, 0, 119, 0, 3, 0, 1, 123, 0, 0, 0, 125, 123, 0, 120, 125, 35, 0, 1, 125, 104, 27, 1, 123, 1, 0, 97, 1, 125, 123, 1, 123, 104, 27, 3, 123, 1, 123, 25, 16, 123, 4, 2, 123, 0, 0, 64, 66, 15, 0, 85, 16, 123, 0, 106, 123, 21, 4, 25, 33, 123, 16, 1, 125, 104, 27, 94, 125, 1, 125, 97, 1, 118, 125, 3, 125, 1, 118, 82, 123, 16, 0, 109, 125, 4, 123, 82, 125, 33, 0, 97, 1, 117, 125, 3, 125, 1, 117, 106, 123, 33, 4, 109, 125, 4, 123, 3, 123, 1, 118, 3, 125, 1, 117, 135, 33, 34, 0, 30, 35, 123, 125, 135, 35, 2, 0, 82, 125, 37, 0, 106, 123, 37, 4, 135, 30, 20, 0, 125, 123, 33, 35, 135, 35, 2, 0, 85, 37, 30, 0, 109, 37, 4, 35, 106, 23, 31, 24, 25, 123, 31, 24, 106, 19, 123, 4, 106, 123, 21, 4, 25, 35, 123, 16, 106, 125, 31, 32, 97, 1, 118, 125, 3, 125, 1, 118, 25, 123, 31, 32, 106, 123, 123, 4, 109, 125, 4, 123, 82, 125, 35, 0, 97, 1, 117, 125, 3, 125, 1, 117, 106, 123, 35, 4, 109, 125, 4, 123, 3, 123, 1, 118, 3, 125, 1, 117, 135, 35, 34, 0, 23, 19, 123, 125, 135, 19, 2, 0, 82, 23, 37, 0, 106, 30, 37, 4, 32, 125, 23, 0, 2, 123, 0, 0, 0, 0, 0, 128, 13, 123, 30, 123, 19, 125, 125, 123, 120, 125, 38, 0, 135, 33, 44, 0, 23, 30, 35, 19, 135, 30, 2, 0, 85, 37, 33, 0, 109, 37, 4, 30, 106, 23, 21, 104, 25, 125, 21, 104, 25, 16, 125, 4, 82, 22, 16, 0, 15, 125, 22, 30, 13, 123, 30, 22, 16, 127, 23, 33, 19, 123, 123, 127, 20, 125, 125, 123, 0, 17, 125, 0, 125, 123, 17, 33, 23, 0, 0, 0, 109, 21, 104, 123, 125, 123, 17, 30, 22, 0, 0, 0, 85, 16, 123, 0, 106, 22, 21, 96, 25, 123, 21, 96, 25, 17, 123, 4, 82, 16, 17, 0, 15, 123, 16, 30, 13, 125, 30, 16, 16, 127, 22, 33, 19, 125, 125, 127, 20, 123, 123, 125, 0, 23, 123, 0, 125, 125, 23, 22, 33, 0, 0, 0, 109, 21, 96, 125, 125, 125, 23, 16, 30, 0, 0, 0, 85, 17, 125, 0, 82, 30, 36, 0, 106, 16, 36, 4, 135, 23, 44, 0, 30, 16, 35, 19, 135, 19, 2, 0, 32, 125, 30, 0, 2, 123, 0, 0, 0, 0, 0, 128, 13, 123, 16, 123, 19, 125, 125, 123, 121, 125, 5, 0, 1, 102, 0, 0, 2, 103, 0, 0, 0, 0, 0, 128, 119, 0, 5, 0, 85, 36, 23, 0, 109, 36, 4, 19, 0, 102, 23, 0, 0, 103, 19, 0, 106, 125, 21, 4, 25, 19, 125, 16, 1, 125, 96, 27, 1, 123, 1, 0, 97, 1, 125, 123, 1, 123, 96, 27, 3, 123, 1, 123, 25, 23, 123, 4, 2, 123, 0, 0, 64, 66, 15, 0, 85, 23, 123, 0, 82, 125, 19, 0, 97, 1, 118, 125, 3, 125, 1, 118, 106, 123, 19, 4, 109, 125, 4, 123, 1, 125, 96, 27, 94, 125, 1, 125, 97, 1, 117, 125, 3, 125, 1, 117, 82, 123, 23, 0, 109, 125, 4, 123, 3, 123, 1, 118, 3, 125, 1, 117, 1, 127, 5, 32, 135, 23, 57, 0, 102, 103, 123, 125, 127, 0, 0, 0, 135, 19, 2, 0, 106, 127, 21, 20, 106, 16, 127, 8, 120, 16, 11, 0, 32, 127, 23, 0, 2, 125, 0, 0, 0, 0, 0, 128, 13, 125, 19, 125, 19, 127, 127, 125, 121, 127, 3, 0, 1, 0, 231, 1, 119, 0, 14, 0, 1, 0, 220, 1, 119, 0, 12, 0, 33, 127, 23, 0, 2, 125, 0, 0, 0, 0, 0, 128, 14, 125, 19, 125, 20, 127, 127, 125, 32, 125, 16, 1, 19, 127, 127, 125, 121, 127, 3, 0, 1, 0, 220, 1, 119, 0, 2, 0, 1, 0, 231, 1, 1, 127, 220, 1, 45, 127, 0, 127, 44, 79, 0, 0, 1, 0, 0, 0, 106, 16, 21, 48, 25, 127, 21, 48, 106, 30, 127, 4, 32, 127, 16, 0, 2, 125, 0, 0, 0, 0, 0, 128, 13, 125, 30, 125, 19, 127, 127, 125, 2, 125, 0, 0, 84, 187, 65, 0, 82, 125, 125, 0, 33, 125, 125, 0, 20, 127, 127, 125, 121, 127, 3, 0, 1, 0, 231, 1, 119, 0, 79, 1, 135, 35, 20, 0, 23, 19, 16, 30, 135, 17, 2, 0, 77, 127, 35, 0, 61, 125, 0, 0, 0, 0, 128, 79, 76, 123, 17, 0, 65, 125, 125, 123, 63, 100, 127, 125, 145, 100, 100, 0, 106, 125, 29, 4, 106, 125, 125, 8, 1, 127, 0, 2, 19, 125, 125, 127, 121, 125, 173, 0, 2, 125, 0, 0, 124, 117, 9, 0, 88, 101, 125, 0, 145, 101, 101, 0, 60, 127, 0, 0, 192, 189, 240, 255, 145, 127, 127, 0, 65, 125, 101, 127, 145, 125, 125, 0, 73, 125, 125, 100, 60, 123, 0, 0, 64, 66, 15, 0, 145, 123, 123, 0, 65, 127, 101, 123, 145, 127, 127, 0, 71, 127, 127, 100, 20, 125, 125, 127, 120, 125, 43, 0, 2, 125, 0, 0, 160, 134, 1, 0, 1, 127, 0, 0, 135, 33, 44, 0, 23, 19, 125, 127, 135, 22, 2, 0, 106, 14, 21, 72, 25, 127, 21, 72, 106, 2, 127, 4, 106, 18, 21, 56, 25, 127, 21, 56, 106, 20, 127, 4, 15, 127, 20, 2, 13, 125, 2, 20, 16, 123, 18, 14, 19, 125, 125, 123, 20, 127, 127, 125, 125, 6, 127, 2, 20, 0, 0, 0, 47, 125, 22, 6, 216, 74, 0, 0, 1, 125, 1, 0, 0, 127, 125, 0, 119, 0, 16, 0, 45, 123, 22, 6, 8, 75, 0, 0, 15, 121, 20, 2, 13, 124, 2, 20, 16, 120, 18, 14, 19, 124, 124, 120, 20, 121, 121, 124, 125, 123, 121, 14, 18, 0, 0, 0, 16, 123, 33, 123, 0, 125, 123, 0, 119, 0, 3, 0, 1, 123, 0, 0, 0, 125, 123, 0, 0, 127, 125, 0, 120, 127, 3, 0, 1, 0, 231, 1, 119, 0, 4, 1, 25, 127, 31, 48, 25, 18, 127, 4, 106, 127, 31, 48, 82, 125, 18, 0, 135, 14, 20, 0, 127, 125, 35, 17, 135, 20, 2, 0, 109, 31, 48, 14, 85, 18, 20, 0, 1, 125, 176, 25, 97, 1, 125, 35, 1, 125, 176, 25, 3, 125, 1, 125, 109, 125, 4, 17, 1, 125, 176, 25, 3, 125, 1, 125, 25, 18, 125, 8, 85, 18, 14, 0, 109, 18, 4, 20, 1, 127, 0, 0, 1, 123, 48, 0, 2, 121, 0, 0, 166, 101, 10, 0, 1, 124, 176, 25, 3, 124, 1, 124, 135, 125, 5, 0, 127, 123, 121, 124, 1, 125, 88, 27, 1, 124, 1, 0, 97, 1, 125, 124, 1, 124, 88, 27, 3, 124, 1, 124, 25, 20, 124, 4, 2, 124, 0, 0, 64, 66, 15, 0, 85, 20, 124, 0, 106, 124, 21, 4, 25, 18, 124, 16, 1, 125, 88, 27, 94, 125, 1, 125, 97, 1, 118, 125, 3, 125, 1, 118, 82, 124, 20, 0, 109, 125, 4, 124, 82, 125, 18, 0, 97, 1, 117, 125, 3, 125, 1, 117, 106, 124, 18, 4, 109, 125, 4, 124, 3, 124, 1, 118, 3, 125, 1, 117, 135, 18, 34, 0, 35, 17, 124, 125, 135, 20, 2, 0, 82, 125, 36, 0, 106, 124, 36, 4, 135, 14, 20, 0, 125, 124, 18, 20, 135, 20, 2, 0, 85, 36, 14, 0, 109, 36, 4, 20, 82, 125, 37, 0, 32, 125, 125, 0, 121, 125, 7, 0, 106, 125, 37, 4, 2, 121, 0, 0, 0, 0, 0, 128, 13, 125, 125, 121, 0, 124, 125, 0, 119, 0, 3, 0, 1, 125, 0, 0, 0, 124, 125, 0, 121, 124, 4, 0, 0, 104, 14, 0, 0, 105, 20, 0, 119, 0, 184, 0, 1, 124, 80, 27, 1, 125, 1, 0, 97, 1, 124, 125, 1, 125, 80, 27, 3, 125, 1, 125, 25, 20, 125, 4, 2, 125, 0, 0, 64, 66, 15, 0, 85, 20, 125, 0, 106, 125, 21, 4, 25, 14, 125, 16, 1, 124, 80, 27, 94, 124, 1, 124, 97, 1, 118, 124, 3, 124, 1, 118, 82, 125, 20, 0, 109, 124, 4, 125, 82, 124, 14, 0, 97, 1, 117, 124, 3, 124, 1, 117, 106, 125, 14, 4, 109, 124, 4, 125, 3, 125, 1, 118, 3, 124, 1, 117, 135, 14, 34, 0, 35, 17, 125, 124, 135, 17, 2, 0, 82, 124, 37, 0, 106, 125, 37, 4, 135, 35, 20, 0, 124, 125, 14, 17, 135, 17, 2, 0, 85, 37, 35, 0, 109, 37, 4, 17, 1, 0, 231, 1, 119, 0, 148, 0, 2, 125, 0, 0, 128, 117, 9, 0, 88, 101, 125, 0, 145, 101, 101, 0, 60, 124, 0, 0, 192, 189, 240, 255, 145, 124, 124, 0, 65, 125, 101, 124, 145, 125, 125, 0, 73, 125, 125, 100, 60, 121, 0, 0, 64, 66, 15, 0, 145, 121, 121, 0, 65, 124, 101, 121, 145, 124, 124, 0, 71, 124, 124, 100, 20, 125, 125, 124, 121, 125, 30, 0, 106, 17, 36, 4, 82, 35, 40, 0, 1, 125, 192, 25, 82, 124, 36, 0, 97, 1, 125, 124, 1, 124, 192, 25, 3, 124, 1, 124, 109, 124, 4, 17, 1, 124, 192, 25, 3, 124, 1, 124, 25, 17, 124, 8, 85, 17, 16, 0, 109, 17, 4, 30, 1, 124, 192, 25, 3, 124, 1, 124, 109, 124, 16, 35, 1, 125, 0, 0, 1, 121, 24, 0, 2, 123, 0, 0, 214, 101, 10, 0, 1, 127, 192, 25, 3, 127, 1, 127, 135, 124, 5, 0, 125, 121, 123, 127, 1, 124, 0, 0, 85, 36, 124, 0, 2, 127, 0, 0, 0, 0, 0, 128, 109, 36, 4, 127, 82, 35, 37, 0, 106, 30, 37, 4, 32, 127, 35, 0, 2, 124, 0, 0, 0, 0, 0, 128, 13, 124, 30, 124, 19, 127, 127, 124, 121, 127, 3, 0, 1, 0, 231, 1, 119, 0, 91, 0, 106, 127, 21, 4, 25, 17, 127, 16, 1, 127, 72, 27, 1, 124, 1, 0, 97, 1, 127, 124, 1, 124, 72, 27, 3, 124, 1, 124, 25, 16, 124, 4, 2, 124, 0, 0, 64, 66, 15, 0, 85, 16, 124, 0, 82, 127, 17, 0, 97, 1, 118, 127, 3, 127, 1, 118, 106, 124, 17, 4, 109, 127, 4, 124, 1, 127, 72, 27, 94, 127, 1, 127, 97, 1, 117, 127, 3, 127, 1, 117, 82, 124, 16, 0, 109, 127, 4, 124, 3, 124, 1, 118, 3, 127, 1, 117, 135, 16, 34, 0, 35, 30, 124, 127, 135, 30, 2, 0, 106, 35, 21, 48, 25, 127, 21, 48, 106, 17, 127, 4, 135, 14, 20, 0, 16, 30, 35, 17, 77, 127, 14, 0, 61, 124, 0, 0, 0, 0, 128, 79, 135, 123, 2, 0, 76, 123, 123, 0, 65, 124, 124, 123, 63, 100, 127, 124, 145, 100, 100, 0, 2, 124, 0, 0, 128, 117, 9, 0, 88, 101, 124, 0, 145, 101, 101, 0, 60, 127, 0, 0, 192, 189, 240, 255, 145, 127, 127, 0, 65, 124, 101, 127, 145, 124, 124, 0, 73, 124, 124, 100, 60, 123, 0, 0, 64, 66, 15, 0, 145, 123, 123, 0, 65, 127, 101, 123, 145, 127, 127, 0, 71, 127, 127, 100, 20, 124, 124, 127, 120, 124, 3, 0, 1, 0, 231, 1, 119, 0, 31, 0, 106, 14, 37, 4, 82, 30, 40, 0, 1, 124, 216, 25, 82, 127, 37, 0, 97, 1, 124, 127, 1, 127, 216, 25, 3, 127, 1, 127, 109, 127, 4, 14, 1, 127, 216, 25, 3, 127, 1, 127, 25, 14, 127, 8, 85, 14, 35, 0, 109, 14, 4, 17, 1, 127, 216, 25, 3, 127, 1, 127, 109, 127, 16, 30, 1, 124, 0, 0, 1, 123, 24, 0, 2, 121, 0, 0, 2, 102, 10, 0, 1, 125, 216, 25, 3, 125, 1, 125, 135, 127, 5, 0, 124, 123, 121, 125, 1, 127, 0, 0, 85, 37, 127, 0, 2, 125, 0, 0, 0, 0, 0, 128, 109, 37, 4, 125, 1, 0, 231, 1, 1, 125, 231, 1, 45, 125, 0, 125, 68, 79, 0, 0, 1, 0, 0, 0, 82, 104, 36, 0, 106, 105, 36, 4, 32, 125, 104, 0, 2, 127, 0, 0, 0, 0, 0, 128, 13, 127, 105, 127, 19, 125, 125, 127, 120, 125, 31, 0, 106, 125, 21, 4, 25, 19, 125, 16, 1, 125, 64, 27, 1, 127, 1, 0, 97, 1, 125, 127, 1, 127, 64, 27, 3, 127, 1, 127, 25, 23, 127, 4, 2, 127, 0, 0, 64, 66, 15, 0, 85, 23, 127, 0, 82, 125, 19, 0, 97, 1, 118, 125, 3, 125, 1, 118, 106, 127, 19, 4, 109, 125, 4, 127, 1, 125, 64, 27, 94, 125, 1, 125, 97, 1, 117, 125, 3, 125, 1, 117, 82, 127, 23, 0, 109, 125, 4, 127, 3, 127, 1, 118, 3, 125, 1, 117, 135, 23, 34, 0, 104, 105, 127, 125, 135, 19, 2, 0, 109, 31, 56, 23, 25, 125, 31, 56, 109, 125, 4, 19, 2, 125, 0, 0, 92, 187, 65, 0, 82, 125, 125, 0, 120, 125, 3, 0, 0, 106, 21, 0, 119, 0, 77, 1, 82, 125, 40, 0, 106, 127, 31, 12, 3, 19, 125, 127, 106, 127, 21, 20, 106, 127, 127, 8], eb + 10240);
                HEAPU8.set([135, 23, 48, 0, 127, 0, 0, 0, 1, 127, 72, 28, 3, 24, 1, 127, 25, 25, 24, 32, 1, 127, 0, 0, 83, 24, 127, 0, 25, 24, 24, 1, 54, 127, 24, 25, 20, 80, 0, 0, 82, 30, 37, 0, 106, 17, 37, 4, 32, 127, 30, 0, 2, 125, 0, 0, 0, 0, 0, 128, 13, 125, 17, 125, 19, 127, 127, 125, 121, 127, 11, 0, 1, 125, 72, 28, 3, 125, 1, 125, 1, 121, 32, 0, 2, 123, 0, 0, 201, 107, 11, 0, 1, 124, 240, 25, 3, 124, 1, 124, 135, 127, 10, 0, 125, 121, 123, 124, 119, 0, 15, 0, 1, 127, 248, 25, 97, 1, 127, 30, 1, 127, 248, 25, 3, 127, 1, 127, 109, 127, 4, 17, 1, 124, 72, 28, 3, 124, 1, 124, 1, 123, 32, 0, 2, 121, 0, 0, 150, 27, 13, 0, 1, 125, 248, 25, 3, 125, 1, 125, 135, 127, 10, 0, 124, 123, 121, 125, 1, 127, 40, 28, 3, 24, 1, 127, 25, 25, 24, 32, 1, 127, 0, 0, 83, 24, 127, 0, 25, 24, 24, 1, 54, 127, 24, 25, 180, 80, 0, 0, 82, 17, 37, 0, 106, 30, 37, 4, 106, 14, 21, 4, 32, 127, 17, 0, 2, 125, 0, 0, 0, 0, 0, 128, 13, 125, 30, 125, 19, 127, 127, 125, 121, 127, 11, 0, 1, 125, 40, 28, 3, 125, 1, 125, 1, 121, 32, 0, 2, 123, 0, 0, 201, 107, 11, 0, 1, 124, 0, 26, 3, 124, 1, 124, 135, 127, 10, 0, 125, 121, 123, 124, 119, 0, 24, 0, 1, 127, 8, 26, 106, 124, 14, 16, 76, 124, 124, 0, 106, 123, 14, 20, 76, 123, 123, 0, 66, 124, 124, 123, 77, 123, 17, 0, 61, 121, 0, 0, 0, 0, 128, 79, 76, 125, 30, 0, 65, 121, 121, 125, 63, 123, 123, 121, 65, 124, 124, 123, 99, 1, 127, 124, 1, 127, 40, 28, 3, 127, 1, 127, 1, 123, 32, 0, 2, 121, 0, 0, 77, 100, 10, 0, 1, 125, 8, 26, 3, 125, 1, 125, 135, 124, 10, 0, 127, 123, 121, 125, 1, 124, 8, 28, 3, 24, 1, 124, 25, 25, 24, 32, 1, 124, 0, 0, 83, 24, 124, 0, 25, 24, 24, 1, 54, 124, 24, 25, 124, 81, 0, 0, 82, 30, 36, 0, 106, 17, 36, 4, 32, 124, 30, 0, 2, 125, 0, 0, 0, 0, 0, 128, 13, 125, 17, 125, 19, 124, 124, 125, 121, 124, 11, 0, 1, 125, 8, 28, 3, 125, 1, 125, 1, 121, 32, 0, 2, 123, 0, 0, 201, 107, 11, 0, 1, 127, 16, 26, 3, 127, 1, 127, 135, 124, 10, 0, 125, 121, 123, 127, 119, 0, 15, 0, 1, 124, 24, 26, 97, 1, 124, 30, 1, 124, 24, 26, 3, 124, 1, 124, 109, 124, 4, 17, 1, 127, 8, 28, 3, 127, 1, 127, 1, 123, 32, 0, 2, 121, 0, 0, 150, 27, 13, 0, 1, 125, 24, 26, 3, 125, 1, 125, 135, 124, 10, 0, 127, 123, 121, 125, 1, 124, 232, 27, 3, 24, 1, 124, 25, 25, 24, 32, 1, 124, 0, 0, 83, 24, 124, 0, 25, 24, 24, 1, 54, 124, 24, 25, 28, 82, 0, 0, 82, 17, 36, 0, 106, 30, 36, 4, 106, 14, 21, 4, 32, 124, 17, 0, 2, 125, 0, 0, 0, 0, 0, 128, 13, 125, 30, 125, 19, 124, 124, 125, 121, 124, 11, 0, 1, 125, 232, 27, 3, 125, 1, 125, 1, 121, 32, 0, 2, 123, 0, 0, 201, 107, 11, 0, 1, 127, 32, 26, 3, 127, 1, 127, 135, 124, 10, 0, 125, 121, 123, 127, 119, 0, 24, 0, 1, 124, 40, 26, 106, 127, 14, 16, 76, 127, 127, 0, 106, 123, 14, 20, 76, 123, 123, 0, 66, 127, 127, 123, 77, 123, 17, 0, 61, 121, 0, 0, 0, 0, 128, 79, 76, 125, 30, 0, 65, 121, 121, 125, 63, 123, 123, 121, 65, 127, 127, 123, 99, 1, 124, 127, 1, 124, 232, 27, 3, 124, 1, 124, 1, 123, 32, 0, 2, 121, 0, 0, 77, 100, 10, 0, 1, 125, 40, 26, 3, 125, 1, 125, 135, 127, 10, 0, 124, 123, 121, 125, 1, 127, 200, 27, 3, 24, 1, 127, 25, 25, 24, 32, 1, 127, 0, 0, 83, 24, 127, 0, 25, 24, 24, 1, 54, 127, 24, 25, 228, 82, 0, 0, 2, 127, 0, 0, 224, 187, 65, 0, 82, 127, 127, 0, 82, 125, 21, 0, 41, 125, 125, 2, 94, 127, 127, 125, 25, 30, 127, 48, 82, 17, 30, 0, 106, 14, 30, 4, 32, 127, 17, 0, 2, 125, 0, 0, 0, 0, 0, 128, 13, 125, 14, 125, 19, 127, 127, 125, 121, 127, 11, 0, 1, 125, 200, 27, 3, 125, 1, 125, 1, 121, 32, 0, 2, 123, 0, 0, 201, 107, 11, 0, 1, 124, 48, 26, 3, 124, 1, 124, 135, 127, 10, 0, 125, 121, 123, 124, 119, 0, 15, 0, 1, 127, 56, 26, 97, 1, 127, 17, 1, 127, 56, 26, 3, 127, 1, 127, 109, 127, 4, 14, 1, 124, 200, 27, 3, 124, 1, 124, 1, 123, 32, 0, 2, 121, 0, 0, 150, 27, 13, 0, 1, 125, 56, 26, 3, 125, 1, 125, 135, 127, 10, 0, 124, 123, 121, 125, 1, 127, 168, 27, 3, 24, 1, 127, 25, 25, 24, 32, 1, 127, 0, 0, 83, 24, 127, 0, 25, 24, 24, 1, 54, 127, 24, 25, 160, 83, 0, 0, 2, 127, 0, 0, 224, 187, 65, 0, 82, 127, 127, 0, 82, 125, 21, 0, 41, 125, 125, 2, 94, 127, 127, 125, 25, 14, 127, 48, 82, 17, 14, 0, 106, 30, 14, 4, 32, 127, 17, 0, 2, 125, 0, 0, 0, 0, 0, 128, 13, 125, 30, 125, 19, 127, 127, 125, 121, 127, 11, 0, 1, 125, 168, 27, 3, 125, 1, 125, 1, 121, 32, 0, 2, 123, 0, 0, 201, 107, 11, 0, 1, 124, 64, 26, 3, 124, 1, 124, 135, 127, 10, 0, 125, 121, 123, 124, 119, 0, 22, 0, 1, 127, 72, 26, 77, 124, 17, 0, 61, 123, 0, 0, 0, 0, 128, 79, 76, 121, 30, 0, 65, 123, 123, 121, 63, 124, 124, 123, 62, 123, 0, 0, 141, 237, 181, 160, 247, 198, 176, 62, 65, 124, 124, 123, 99, 1, 127, 124, 1, 127, 168, 27, 3, 127, 1, 127, 1, 123, 32, 0, 2, 121, 0, 0, 77, 100, 10, 0, 1, 125, 72, 26, 3, 125, 1, 125, 135, 124, 10, 0, 127, 123, 121, 125, 1, 124, 80, 26, 97, 1, 124, 19, 1, 124, 80, 26, 3, 124, 1, 124, 109, 124, 4, 23, 1, 124, 80, 26, 3, 124, 1, 124, 1, 125, 72, 28, 3, 125, 1, 125, 109, 124, 8, 125, 1, 125, 80, 26, 3, 125, 1, 125, 1, 124, 40, 28, 3, 124, 1, 124, 109, 125, 12, 124, 1, 124, 80, 26, 3, 124, 1, 124, 1, 125, 8, 28, 3, 125, 1, 125, 109, 124, 16, 125, 1, 125, 80, 26, 3, 125, 1, 125, 1, 124, 232, 27, 3, 124, 1, 124, 109, 125, 20, 124, 1, 124, 80, 26, 3, 124, 1, 124, 1, 125, 200, 27, 3, 125, 1, 125, 109, 124, 24, 125, 1, 125, 80, 26, 3, 125, 1, 125, 1, 124, 168, 27, 3, 124, 1, 124, 109, 125, 28, 124, 1, 125, 0, 0, 1, 121, 32, 0, 2, 123, 0, 0, 46, 102, 10, 0, 1, 127, 80, 26, 3, 127, 1, 127, 135, 124, 5, 0, 125, 121, 123, 127, 0, 106, 21, 0, 82, 30, 37, 0, 106, 17, 37, 4, 2, 124, 0, 0, 224, 187, 65, 0, 82, 124, 124, 0, 82, 127, 106, 0, 41, 127, 127, 2, 94, 14, 124, 127, 1, 124, 0, 0, 106, 127, 14, 88, 47, 124, 124, 127, 224, 87, 0, 0, 1, 35, 0, 0, 2, 124, 0, 0, 216, 187, 65, 0, 82, 124, 124, 0, 106, 127, 14, 12, 3, 127, 127, 35, 41, 127, 127, 2, 94, 16, 124, 127, 1, 124, 228, 0, 94, 124, 16, 124, 121, 124, 151, 0, 106, 124, 21, 4, 25, 20, 124, 16, 106, 124, 16, 4, 25, 18, 124, 16, 82, 127, 20, 0, 97, 1, 118, 127, 3, 127, 1, 118, 106, 124, 20, 4, 109, 127, 4, 124, 82, 127, 18, 0, 97, 1, 117, 127, 3, 127, 1, 117, 106, 124, 18, 4, 109, 127, 4, 124, 3, 124, 1, 118, 3, 127, 1, 117, 135, 18, 34, 0, 30, 17, 124, 127, 135, 20, 2, 0, 1, 127, 255, 255, 1, 124, 255, 255, 135, 2, 44, 0, 18, 20, 127, 124, 135, 33, 2, 0, 1, 124, 208, 0, 3, 124, 16, 124, 106, 6, 124, 4, 47, 127, 6, 33, 248, 85, 0, 0, 1, 127, 1, 0, 0, 124, 127, 0, 119, 0, 11, 0, 45, 123, 33, 6, 20, 86, 0, 0, 1, 123, 208, 0, 94, 123, 16, 123, 16, 123, 123, 2, 0, 127, 123, 0, 119, 0, 3, 0, 1, 123, 0, 0, 0, 127, 123, 0, 0, 124, 127, 0, 120, 124, 2, 0, 119, 0, 107, 0, 1, 124, 216, 0, 94, 6, 16, 124, 1, 124, 216, 0, 3, 124, 16, 124, 106, 22, 124, 4, 15, 124, 22, 20, 13, 127, 20, 22, 16, 123, 6, 18, 19, 127, 127, 123, 20, 124, 124, 127, 121, 124, 3, 0, 1, 0, 5, 2, 119, 0, 13, 0, 32, 124, 6, 255, 2, 127, 0, 0, 255, 255, 255, 127, 13, 127, 22, 127, 19, 124, 124, 127, 1, 127, 228, 0, 94, 127, 16, 127, 82, 127, 127, 0, 33, 127, 127, 0, 20, 124, 124, 127, 120, 124, 2, 0, 1, 0, 5, 2, 1, 124, 5, 2, 45, 124, 0, 124, 168, 86, 0, 0, 1, 0, 0, 0, 1, 127, 0, 0, 135, 124, 58, 0, 16, 127, 0, 0, 1, 124, 248, 0, 94, 124, 16, 124, 36, 124, 124, 0, 120, 124, 71, 0, 1, 22, 0, 0, 1, 6, 0, 0, 1, 127, 244, 0, 94, 127, 16, 127, 41, 123, 22, 2, 94, 127, 127, 123, 82, 127, 127, 0, 135, 124, 39, 0, 127, 0, 0, 0, 3, 6, 124, 6, 25, 22, 22, 1, 1, 124, 248, 0, 94, 107, 16, 124, 54, 124, 22, 107, 192, 86, 0, 0, 120, 6, 2, 0, 119, 0, 54, 0, 1, 124, 228, 0, 94, 22, 16, 124, 109, 22, 104, 2, 25, 124, 22, 104, 109, 124, 4, 33, 1, 124, 208, 0, 97, 16, 124, 2, 1, 124, 208, 0, 3, 124, 16, 124, 109, 124, 4, 33, 1, 124, 0, 0, 47, 124, 124, 107, 208, 87, 0, 0, 1, 18, 0, 0, 1, 124, 244, 0, 94, 124, 16, 124, 41, 127, 18, 2, 94, 124, 124, 127, 82, 124, 124, 0, 1, 127, 12, 0, 135, 20, 59, 0, 124, 22, 127, 0, 2, 127, 0, 0, 187, 176, 185, 223, 14, 127, 20, 127, 34, 124, 20, 0, 19, 127, 127, 124, 121, 127, 21, 0, 0, 24, 1, 0, 25, 25, 24, 64, 1, 127, 0, 0, 85, 24, 127, 0, 25, 24, 24, 4, 54, 127, 24, 25, 116, 87, 0, 0, 1, 124, 64, 0, 135, 127, 11, 0, 20, 1, 124, 0, 1, 127, 112, 26, 97, 1, 127, 1, 1, 124, 0, 0, 1, 123, 24, 0, 2, 121, 0, 0, 147, 92, 10, 0, 1, 125, 112, 26, 3, 125, 1, 125, 135, 127, 5, 0, 124, 123, 121, 125, 25, 18, 18, 1, 1, 127, 248, 0, 94, 127, 16, 127, 54, 127, 18, 127, 52, 87, 0, 0, 25, 35, 35, 1, 106, 127, 14, 88, 54, 127, 35, 127, 80, 85, 0, 0, 1, 125, 64, 22, 3, 125, 1, 125, 1, 121, 0, 0, 135, 127, 41, 0, 21, 125, 121, 0, 119, 0, 124, 0, 2, 127, 0, 0, 224, 187, 65, 0, 82, 127, 127, 0, 41, 121, 32, 2, 94, 14, 127, 121, 82, 35, 14, 0, 106, 127, 35, 28, 41, 121, 28, 2, 94, 17, 127, 121, 106, 127, 14, 92, 49, 127, 127, 28, 228, 89, 0, 0, 1, 127, 176, 0, 94, 127, 17, 127, 82, 127, 127, 0, 135, 30, 48, 0, 127, 0, 0, 0, 82, 23, 40, 0, 1, 127, 64, 22, 3, 127, 1, 127, 25, 19, 127, 56, 82, 16, 19, 0, 106, 18, 19, 4, 1, 127, 64, 1, 1, 121, 0, 0, 97, 1, 127, 121, 1, 121, 64, 1, 3, 121, 1, 121, 1, 127, 0, 0, 109, 121, 4, 127, 1, 127, 64, 1, 3, 127, 1, 127, 1, 121, 0, 0, 109, 127, 8, 121, 1, 121, 64, 1, 3, 121, 1, 121, 1, 127, 0, 0, 109, 121, 12, 127, 1, 127, 64, 1, 3, 127, 1, 127, 1, 121, 0, 0, 109, 127, 16, 121, 1, 121, 64, 1, 3, 121, 1, 121, 1, 127, 0, 0, 109, 121, 20, 127, 1, 127, 64, 1, 3, 127, 1, 127, 1, 121, 0, 0, 109, 127, 24, 121, 1, 121, 64, 1, 3, 121, 1, 121, 1, 127, 0, 0, 109, 121, 28, 127, 82, 19, 36, 0, 106, 22, 36, 4, 32, 127, 19, 0, 2, 121, 0, 0, 0, 0, 0, 128, 13, 121, 22, 121, 19, 127, 127, 121, 121, 127, 11, 0, 1, 121, 64, 1, 3, 121, 1, 121, 1, 125, 32, 0, 2, 123, 0, 0, 201, 107, 11, 0, 1, 124, 144, 24, 3, 124, 1, 124, 135, 127, 10, 0, 121, 125, 123, 124, 119, 0, 24, 0, 1, 127, 152, 24, 106, 124, 17, 16, 76, 124, 124, 0, 106, 123, 17, 20, 76, 123, 123, 0, 66, 124, 124, 123, 77, 123, 19, 0, 61, 125, 0, 0, 0, 0, 128, 79, 76, 121, 22, 0, 65, 125, 125, 121, 63, 123, 123, 125, 65, 124, 124, 123, 99, 1, 127, 124, 1, 127, 64, 1, 3, 127, 1, 127, 1, 123, 32, 0, 2, 125, 0, 0, 77, 100, 10, 0, 1, 121, 152, 24, 3, 121, 1, 121, 135, 124, 10, 0, 127, 123, 125, 121, 1, 124, 160, 24, 97, 1, 124, 30, 1, 124, 160, 24, 3, 124, 1, 124, 109, 124, 4, 32, 1, 124, 160, 24, 3, 124, 1, 124, 109, 124, 8, 23, 1, 124, 160, 24, 3, 124, 1, 124, 25, 23, 124, 16, 85, 23, 16, 0, 109, 23, 4, 18, 1, 124, 160, 24, 3, 124, 1, 124, 1, 121, 64, 1, 3, 121, 1, 121, 109, 124, 24, 121, 1, 124, 24, 0, 2, 125, 0, 0, 82, 100, 10, 0, 1, 123, 160, 24, 3, 123, 1, 123, 135, 121, 5, 0, 35, 124, 125, 123, 82, 123, 40, 0, 25, 123, 123, 1, 109, 14, 92, 123, 1, 121, 64, 22, 3, 121, 1, 121, 135, 123, 60, 0, 121, 0, 0, 0, 1, 74, 0, 0, 1, 123, 42, 1, 45, 123, 0, 123, 20, 90, 0, 0, 1, 0, 0, 0, 1, 121, 1, 0, 109, 31, 8, 121, 1, 74, 245, 255, 32, 121, 74, 245, 121, 121, 14, 0, 2, 121, 0, 0, 224, 187, 65, 0, 82, 121, 121, 0, 82, 123, 63, 0, 41, 123, 123, 2, 94, 121, 121, 123, 106, 121, 121, 8, 120, 121, 2, 0, 119, 0, 22, 0, 1, 121, 48, 1, 1, 123, 1, 0, 97, 58, 121, 123, 119, 0, 18, 0, 34, 123, 74, 0, 121, 123, 3, 0, 0, 60, 74, 0, 119, 0, 5, 0, 1, 123, 0, 0, 135, 60, 38, 0, 123, 0, 0, 0, 119, 0, 1, 0, 34, 123, 60, 0, 2, 121, 0, 0, 187, 176, 185, 223, 14, 121, 60, 121, 19, 123, 123, 121, 121, 123, 4, 0, 1, 0, 25, 2, 119, 0, 23, 0, 1, 0, 246, 0, 1, 123, 246, 0, 45, 123, 0, 123, 196, 90, 0, 0, 1, 0, 0, 0, 1, 121, 0, 0, 1, 125, 40, 0, 2, 124, 0, 0, 152, 99, 10, 0, 1, 127, 88, 24, 3, 127, 1, 127, 135, 123, 5, 0, 121, 125, 124, 127, 1, 127, 0, 0, 135, 123, 61, 0, 127, 26, 34, 41, 38, 0, 0, 0, 2, 123, 0, 0, 76, 188, 65, 0, 82, 123, 123, 0, 121, 123, 79, 237, 119, 0, 118, 0, 1, 123, 209, 0, 52, 123, 0, 123, 188, 92, 0, 0, 1, 123, 222, 0, 45, 123, 0, 123, 36, 91, 0, 0, 1, 127, 0, 0, 1, 124, 40, 0, 2, 125, 0, 0, 23, 99, 10, 0, 1, 121, 72, 24, 3, 121, 1, 121, 135, 123, 5, 0, 127, 124, 125, 121, 119, 0, 103, 0, 1, 123, 5, 1, 45, 123, 0, 123, 140, 91, 0, 0, 106, 40, 58, 4, 1, 123, 104, 24, 82, 121, 58, 0, 97, 1, 123, 121, 1, 121, 104, 24, 3, 121, 1, 121, 109, 121, 4, 40, 1, 121, 104, 24, 3, 121, 1, 121, 3, 123, 1, 118, 109, 121, 8, 123, 1, 121, 0, 0, 1, 125, 16, 0, 2, 124, 0, 0, 224, 99, 10, 0, 1, 127, 104, 24, 3, 127, 1, 127, 135, 123, 5, 0, 121, 125, 124, 127, 1, 127, 1, 0, 135, 123, 13, 0, 127, 0, 0, 0, 119, 0, 77, 0, 1, 123, 33, 1, 45, 123, 0, 123, 244, 91, 0, 0, 1, 123, 120, 24, 2, 127, 0, 0, 14, 100, 10, 0, 97, 1, 123, 127, 1, 127, 120, 24, 3, 127, 1, 127, 2, 123, 0, 0, 37, 100, 10, 0, 109, 127, 4, 123, 1, 123, 120, 24, 3, 123, 1, 123, 1, 127, 25, 18, 109, 123, 8, 127, 1, 123, 0, 0, 1, 124, 0, 0, 2, 125, 0, 0, 102, 48, 13, 0, 1, 121, 120, 24, 3, 121, 1, 121, 135, 127, 5, 0, 123, 124, 125, 121, 135, 127, 62, 0, 119, 0, 51, 0, 1, 127, 97, 1, 45, 127, 0, 127, 16, 92, 0, 0, 1, 121, 1, 0, 135, 127, 13, 0, 121, 0, 0, 0, 119, 0, 44, 0, 1, 127, 132, 1, 45, 127, 0, 127, 44, 92, 0, 0, 1, 121, 1, 0, 135, 127, 13, 0, 121, 0, 0, 0, 119, 0, 37, 0, 1, 127, 194, 1, 45, 127, 0, 127, 72, 92, 0, 0, 1, 121, 1, 0, 135, 127, 13, 0, 121, 0, 0, 0, 119, 0, 30, 0, 1, 127, 25, 2, 45, 127, 0, 127, 188, 92, 0, 0, 1, 127, 72, 30, 3, 24, 1, 127, 25, 25, 24, 64, 1, 127, 0, 0, 83, 24, 127, 0, 25, 24, 24, 1, 54, 127, 24, 25, 96, 92, 0, 0, 1, 121, 72, 30, 3, 121, 1, 121, 1, 125, 64, 0, 135, 127, 11, 0, 60, 121, 125, 0, 1, 127, 120, 26, 1, 125, 72, 30, 3, 125, 1, 125, 97, 1, 127, 125, 1, 127, 0, 0, 1, 121, 16, 0, 2, 124, 0, 0, 159, 102, 10, 0, 1, 123, 120, 26, 3, 123, 1, 123, 135, 125, 5, 0, 127, 121, 124, 123, 119, 0, 1, 0, 2, 125, 0, 0, 220, 187, 65, 0, 82, 60, 125, 0, 1, 125, 0, 0, 47, 125, 125, 60, 72, 93, 0, 0, 1, 58, 0, 0, 0, 74, 60, 0, 2, 125, 0, 0, 216, 187, 65, 0, 82, 125, 125, 0, 41, 123, 58, 2, 94, 60, 125, 123, 2, 125, 0, 0, 224, 187, 65, 0, 82, 125, 125, 0, 82, 123, 60, 0, 41, 123, 123, 2, 94, 125, 125, 123, 106, 125, 125, 4, 120, 125, 9, 0, 1, 123, 0, 0, 1, 124, 0, 0, 135, 125, 41, 0, 60, 123, 124, 0, 2, 125, 0, 0, 220, 187, 65, 0, 82, 108, 125, 0, 119, 0, 2, 0, 0, 108, 74, 0, 25, 58, 58, 1, 56, 125, 108, 58, 72, 93, 0, 0, 0, 74, 108, 0, 119, 0, 230, 255, 1, 125, 0, 0, 2, 124, 0, 0, 236, 187, 65, 0, 82, 124, 124, 0, 47, 125, 125, 124, 40, 100, 0, 0, 1, 108, 0, 0, 2, 125, 0, 0, 232, 187, 65, 0, 82, 125, 125, 0, 41, 124, 108, 2, 94, 109, 125, 124, 106, 74, 109, 80, 2, 125, 0, 0, 240, 187, 65, 0, 82, 125, 125, 0, 82, 124, 109, 0, 41, 124, 124, 2, 94, 58, 125, 124, 106, 125, 109, 16, 121, 125, 30, 1, 1, 125, 56, 1, 94, 125, 109, 125, 120, 125, 135, 0, 1, 125, 8, 1, 94, 125, 109, 125, 106, 60, 125, 8, 3, 124, 1, 118, 1, 123, 0, 0, 1, 121, 0, 4, 135, 125, 0, 0, 124, 123, 121, 0, 106, 125, 109, 12, 82, 63, 125, 0, 1, 125, 128, 26, 82, 121, 109, 0, 97, 1, 125, 121, 1, 121, 128, 26, 3, 121, 1, 121, 109, 121, 4, 63, 1, 125, 0, 0, 1, 123, 24, 0, 2, 124, 0, 0, 186, 102, 10, 0, 1, 127, 128, 26, 3, 127, 1, 127, 135, 121, 5, 0, 125, 123, 124, 127, 1, 121, 8, 1, 94, 121, 109, 121, 121, 121, 101, 0, 106, 121, 60, 8, 120, 121, 99, 0, 106, 63, 60, 20, 1, 121, 0, 0, 47, 121, 121, 63, 20, 95, 0, 0, 1, 107, 0, 0, 0, 106, 63, 0, 106, 121, 60, 16, 41, 127, 107, 2, 94, 105, 121, 127, 106, 121, 105, 24, 34, 121, 121, 0, 121, 121, 29, 0, 106, 121, 105, 4, 106, 121, 121, 4, 1, 127, 176, 0, 94, 104, 121, 127, 106, 127, 104, 20, 109, 105, 24, 127, 106, 121, 104, 108, 109, 105, 44, 121, 106, 127, 104, 104, 109, 105, 48, 127, 25, 127, 104, 96, 106, 103, 127, 4, 106, 121, 104, 96, 109, 105, 56, 121, 25, 121, 105, 56, 109, 121, 4, 103, 106, 127, 104, 48, 109, 105, 28, 127, 106, 121, 104, 52, 109, 105, 32, 121, 25, 121, 104, 56, 106, 103, 121, 4, 106, 127, 104, 56, 109, 105, 36, 127, 25, 127, 105, 36, 109, 127, 4, 103, 106, 110, 60, 20, 119, 0, 2, 0, 0, 110, 106, 0, 25, 107, 107, 1, 56, 127, 110, 107, 212, 94, 0, 0, 0, 106, 110, 0, 119, 0, 217, 255, 36, 127, 110, 0, 120, 127, 15, 0, 106, 106, 60, 16, 1, 107, 0, 0, 41, 127, 107, 2, 94, 103, 106, 127, 106, 127, 103, 24, 34, 127, 127, 0, 121, 127, 4, 0, 106, 127, 103, 16, 35, 127, 127, 2, 120, 127, 196, 0, 25, 107, 107, 1, 56, 127, 110, 107, 20, 95, 0, 0, 119, 0, 245, 255, 135, 127, 36, 0, 60, 0, 0, 0, 34, 127, 127, 0, 121, 127, 3, 0, 1, 0, 49, 2, 119, 0, 193, 0, 2, 127, 0, 0, 240, 187, 65, 0, 82, 127, 127, 0, 82, 121, 109, 0, 41, 121, 121, 2, 94, 63, 127, 121, 1, 127, 44, 1, 1, 121, 3, 0, 97, 109, 127, 121, 106, 121, 63, 40, 120, 121, 2, 0, 119, 0, 19, 0, 82, 121, 63, 0, 106, 31, 121, 24, 120, 31, 2, 0, 119, 0, 15, 0, 2, 121, 0, 0, 232, 187, 65, 0, 82, 107, 121, 0, 106, 106, 63, 8, 1, 63, 0, 0, 3, 121, 63, 106, 41, 121, 121, 2, 94, 121, 107, 121, 1, 127, 44, 1, 1, 124, 3, 0, 97, 121, 127, 124, 25, 63, 63, 1, 53, 124, 63, 31, 128, 95, 0, 0, 3, 127, 1, 118, 135, 124, 15, 0, 109, 127, 0, 0, 34, 124, 124, 0, 121, 124, 3, 0, 1, 0, 56, 2, 119, 0, 156, 0, 106, 60, 74, 8, 1, 124, 0, 0, 1, 127, 2, 0, 138, 60, 124, 127, 220, 95, 0, 0, 224, 95, 0, 0, 119, 0, 142, 0, 119, 0, 5, 0, 1, 124, 100, 1, 94, 124, 74, 124, 34, 124, 124, 2, 120, 124, 137, 0, 0, 31, 60, 0, 1, 124, 0, 0, 1, 127, 2, 0, 138, 31, 124, 127, 16, 96, 0, 0, 28, 96, 0, 0, 1, 0, 63, 2, 119, 0, 136, 0, 2, 111, 0, 0, 96, 48, 13, 0, 119, 0, 4, 0, 2, 111, 0, 0, 90, 48, 13, 0, 119, 0, 1, 0, 3, 127, 1, 116, 135, 124, 63, 0, 127, 0, 0, 0, 3, 124, 1, 116, 1, 127, 0, 0, 109, 124, 24, 127, 3, 127, 1, 116, 1, 124, 0, 0, 109, 127, 28, 124, 1, 127, 0, 0, 1, 121, 176, 26, 3, 121, 1, 121, 135, 124, 64, 0, 127, 121, 0, 0, 3, 124, 1, 116, 135, 60, 65, 0, 74, 124, 0, 0, 32, 124, 60, 245, 121, 124, 15, 0, 1, 124, 0, 0, 135, 112, 66, 0, 74, 124, 0, 0, 34, 124, 112, 0, 121, 124, 3, 0, 1, 0, 68, 2, 119, 0, 104, 0, 3, 124, 1, 116, 135, 63, 65, 0, 74, 124, 0, 0, 33, 124, 63, 245, 121, 124, 245, 255, 0, 113, 63, 0, 119, 0, 2, 0, 0, 113, 60, 0, 82, 63, 109, 0, 106, 106, 109, 4, 1, 124, 192, 26, 97, 1, 124, 111, 1, 124, 192, 26, 3, 124, 1, 124, 109, 124, 4, 63, 1, 124, 192, 26, 3, 124, 1, 124, 109, 124, 8, 106, 2, 121, 0, 0, 42, 103, 10, 0, 1, 127, 192, 26, 3, 127, 1, 127, 135, 124, 64, 0, 121, 127, 0, 0, 34, 124, 113, 0, 2, 127, 0, 0, 187, 176, 185, 223, 14, 127, 113, 127, 19, 124, 124, 127, 121, 124, 3, 0, 1, 0, 70, 2, 119, 0, 72, 0, 1, 124, 4, 1, 94, 106, 109, 124, 121, 106, 7, 0, 1, 124, 44, 2, 94, 63, 74, 124, 120, 63, 2, 0, 119, 0, 3, 0, 135, 124, 67, 0, 63, 106, 0, 0, 2, 124, 0, 0, 187, 176, 185, 223, 52, 124, 113, 124, 0, 98, 0, 0, 1, 124, 44, 1, 94, 124, 109, 124, 38, 124, 124, 2, 120, 124, 39, 0, 106, 127, 74, 76, 97, 1, 118, 127, 3, 127, 1, 118, 25, 124, 74, 76, 106, 124, 124, 4, 109, 127, 4, 124, 106, 127, 109, 56, 97, 1, 117, 127, 3, 127, 1, 117, 25, 124, 109, 56, 106, 124, 124, 4, 109, 127, 4, 124, 3, 127, 1, 116, 3, 121, 1, 118, 3, 123, 1, 117, 135, 124, 68, 0, 127, 121, 123, 0, 3, 124, 1, 116, 106, 106, 124, 28, 3, 123, 1, 116, 1, 121, 0, 0, 135, 124, 69, 0, 58, 123, 109, 121, 2, 121, 0, 0, 156, 187, 65, 0, 82, 121, 121, 0, 121, 121, 6, 0, 106, 121, 109, 80, 106, 121, 121, 8, 32, 121, 121, 0, 0, 124, 121, 0, 119, 0, 3, 0, 1, 121, 0, 0, 0, 124, 121, 0, 121, 124, 7, 0, 135, 124, 70, 0, 109, 106, 0, 0, 119, 0, 4, 0, 3, 121, 1, 116, 135, 124, 60, 0, 121, 0, 0, 0, 106, 31, 74, 8, 119, 0, 126, 255, 3, 121, 1, 116, 1, 123, 1, 0, 135, 124, 69, 0, 58, 121, 109, 123, 25, 108, 108, 1, 2, 124, 0, 0, 236, 187, 65, 0, 82, 124, 124, 0, 56, 124, 124, 108, 40, 100, 0, 0, 119, 0, 207, 254, 1, 124, 49, 2, 45, 124, 0, 124, 104, 98, 0, 0, 1, 123, 0, 0, 1, 121, 16, 0, 2, 127, 0, 0, 242, 102, 10, 0, 1, 125, 136, 26, 3, 125, 1, 125, 135, 124, 5, 0, 123, 121, 127, 125, 1, 125, 1, 0, 135, 124, 13, 0, 125, 0, 0, 0, 119, 0, 113, 0, 1, 124, 56, 2, 45, 124, 0, 124, 208, 98, 0, 0, 106, 108, 109, 4, 1, 124, 144, 26, 82, 125, 109, 0, 97, 1, 124, 125, 1, 125, 144, 26, 3, 125, 1, 125, 109, 125, 4, 108, 1, 125, 144, 26, 3, 125, 1, 125, 3, 124, 1, 118, 109, 125, 8, 124, 1, 125, 0, 0, 1, 127, 16, 0, 2, 121, 0, 0, 224, 99, 10, 0, 1, 123, 144, 26, 3, 123, 1, 123, 135, 124, 5, 0, 125, 127, 121, 123, 1, 123, 1, 0, 135, 124, 13, 0, 123, 0, 0, 0, 119, 0, 87, 0, 1, 124, 63, 2, 45, 124, 0, 124, 56, 99, 0, 0, 1, 124, 160, 26, 2, 123, 0, 0, 8, 100, 13, 0, 97, 1, 124, 123, 1, 123, 160, 26, 3, 123, 1, 123, 2, 124, 0, 0, 37, 100, 10, 0, 109, 123, 4, 124, 1, 124, 160, 26, 3, 124, 1, 124, 1, 123, 139, 7, 109, 124, 8, 123, 1, 124, 0, 0, 1, 121, 0, 0, 2, 127, 0, 0, 102, 48, 13, 0, 1, 125, 160, 26, 3, 125, 1, 125, 135, 123, 5, 0, 124, 121, 127, 125, 135, 123, 62, 0, 119, 0, 61, 0, 1, 123, 68, 2, 45, 123, 0, 123, 172, 99, 0, 0, 0, 24, 1, 0, 25, 25, 24, 64, 1, 123, 0, 0, 85, 24, 123, 0, 25, 24, 24, 4, 54, 123, 24, 25, 76, 99, 0, 0, 135, 108, 71, 0, 1, 112, 0, 0, 1, 123, 184, 26, 97, 1, 123, 111, 1, 123, 184, 26, 3, 123, 1, 123, 109, 123, 4, 108, 1, 125, 0, 0, 1, 127, 8, 0, 2, 121, 0, 0, 18, 103, 10, 0, 1, 124, 184, 26, 3, 124, 1, 124, 135, 123, 5, 0, 125, 127, 121, 124, 1, 124, 1, 0, 135, 123, 13, 0, 124, 0, 0, 0, 119, 0, 32, 0, 1, 123, 70, 2, 45, 123, 0, 123, 40, 100, 0, 0, 1, 123, 136, 29, 3, 24, 1, 123, 25, 25, 24, 64, 1, 123, 0, 0, 83, 24, 123, 0, 25, 24, 24, 1, 54, 123, 24, 25, 196, 99, 0, 0, 1, 123, 136, 29, 3, 123, 1, 123, 135, 108, 71, 0, 123, 113, 0, 0, 1, 123, 208, 26, 97, 1, 123, 111, 1, 123, 208, 26, 3, 123, 1, 123, 109, 123, 4, 108, 1, 124, 0, 0, 1, 121, 8, 0, 2, 127, 0, 0, 18, 103, 10, 0, 1, 125, 208, 26, 3, 125, 1, 125, 135, 123, 5, 0, 124, 121, 127, 125, 1, 125, 1, 0, 135, 123, 13, 0, 125, 0, 0, 0, 1, 123, 216, 26, 2, 125, 0, 0, 218, 192, 65, 0, 97, 1, 123, 125, 1, 123, 0, 0, 1, 127, 248, 255, 2, 121, 0, 0, 140, 27, 13, 0, 1, 124, 216, 26, 3, 124, 1, 124, 135, 125, 5, 0, 123, 127, 121, 124, 2, 125, 0, 0, 8, 188, 65, 0, 82, 125, 125, 0, 121, 125, 7, 0, 1, 124, 0, 0, 1, 121, 0, 0, 2, 127, 0, 0, 12, 188, 65, 0, 135, 125, 25, 0, 124, 121, 127, 0, 1, 125, 0, 0, 2, 127, 0, 0, 244, 187, 65, 0, 82, 127, 127, 0, 47, 125, 125, 127, 188, 101, 0, 0, 1, 111, 0, 0, 2, 125, 0, 0, 240, 187, 65, 0, 82, 125, 125, 0, 41, 127, 111, 2, 94, 113, 125, 127, 82, 112, 113, 0, 106, 125, 113, 44, 120, 125, 17, 0, 1, 125, 32, 4, 94, 113, 112, 125, 1, 125, 224, 26, 97, 1, 125, 111, 1, 125, 224, 26, 3, 125, 1, 125, 109, 125, 4, 113, 1, 127, 0, 0, 1, 121, 16, 0, 2, 124, 0, 0, 57, 103, 10, 0, 1, 123, 224, 26, 3, 123, 1, 123, 135, 125, 5, 0, 127, 121, 124, 123, 119, 0, 39, 0, 135, 113, 72, 0, 112, 0, 0, 0, 34, 125, 113, 0, 121, 125, 35, 0, 1, 125, 32, 4, 94, 109, 112, 125, 1, 125, 8, 30, 3, 24, 1, 125, 25, 25, 24, 64, 1, 125, 0, 0, 83, 24, 125, 0, 25, 24, 24, 1, 54, 125, 24, 25, 32, 101, 0, 0, 1, 123, 8, 30, 3, 123, 1, 123, 1, 124, 64, 0, 135, 125, 11, 0, 113, 123, 124, 0, 1, 125, 232, 26, 97, 1, 125, 109, 1, 125, 232, 26, 3, 125, 1, 125, 1, 124, 8, 30, 3, 124, 1, 124, 109, 125, 4, 124, 1, 125, 0, 0, 1, 123, 16, 0, 2, 121, 0, 0, 161, 103, 10, 0, 1, 127, 232, 26, 3, 127, 1, 127, 135, 124, 5, 0, 125, 123, 121, 127, 2, 124, 0, 0, 96, 187, 65, 0, 82, 124, 124, 0, 120, 124, 8, 0, 25, 111, 111, 1, 2, 124, 0, 0, 244, 187, 65, 0, 82, 124, 124, 0, 56, 124, 124, 111, 188, 101, 0, 0, 119, 0, 188, 255, 1, 127, 1, 0, 135, 124, 13, 0, 127, 0, 0, 0, 135, 111, 1, 0, 1, 127, 1, 0, 135, 121, 2, 0, 135, 124, 61, 0, 127, 26, 34, 111, 121, 0, 0, 0, 2, 124, 0, 0, 236, 187, 65, 0, 82, 111, 124, 0, 1, 124, 0, 0, 47, 124, 124, 111, 140, 102, 0, 0, 1, 34, 0, 0, 1, 26, 0, 0, 1, 112, 0, 0, 0, 110, 111, 0, 2, 124, 0, 0, 232, 187, 65, 0, 82, 124, 124, 0, 41, 121, 34, 2, 94, 111, 124, 121, 106, 124, 111, 16, 120, 124, 3, 0, 0, 114, 110, 0, 119, 0, 9, 0, 106, 121, 111, 80, 1, 127, 48, 2, 3, 121, 121, 127, 135, 124, 73, 0, 121, 0, 0, 0, 2, 124, 0, 0, 236, 187, 65, 0, 82, 114, 124, 0, 1, 124, 96, 1, 94, 124, 111, 124, 1, 121, 96, 1, 3, 121, 111, 121, 106, 121, 121, 4, 135, 26, 44, 0, 124, 121, 26, 112, 135, 112, 2, 0, 25, 34, 34, 1, 56, 121, 114, 34, 116, 102, 0, 0, 0, 110, 114, 0, 119, 0, 227, 255, 32, 121, 26, 0, 32, 124, 112, 0, 19, 121, 121, 124, 121, 121, 4, 0, 1, 0, 99, 2, 119, 0, 2, 0, 1, 0, 99, 2, 1, 121, 99, 2, 45, 121, 0, 121, 220, 102, 0, 0, 2, 121, 0, 0, 100, 187, 65, 0, 82, 121, 121, 0, 38, 121, 121, 1, 121, 121, 12, 0, 1, 124, 0, 0, 1, 127, 8, 0, 2, 123, 0, 0, 194, 103, 10, 0, 1, 125, 240, 26, 3, 125, 1, 125, 135, 121, 5, 0, 124, 127, 123, 125, 1, 125, 1, 0, 135, 121, 13, 0, 125, 0, 0, 0, 1, 121, 0, 0, 2, 125, 0, 0, 220, 187, 65, 0, 82, 125, 125, 0, 47, 121, 121, 125, 88, 103, 0, 0, 1, 0, 0, 0, 2, 121, 0, 0, 216, 187, 65, 0, 82, 121, 121, 0, 41, 125, 0, 2, 94, 112, 121, 125, 106, 121, 112, 16, 121, 121, 12, 0, 106, 125, 112, 20, 135, 121, 14, 0, 125, 0, 0, 0, 1, 121, 20, 1, 94, 26, 112, 121, 121, 26, 6, 0, 1, 125, 255, 0, 19, 125, 26, 125, 106, 123, 112, 20, 135, 121, 74, 0, 125, 123, 0, 0, 25, 0, 0, 1, 2, 121, 0, 0, 220, 187, 65, 0, 82, 121, 121, 0, 54, 121, 0, 121, 248, 102, 0, 0, 2, 125, 0, 0, 164, 187, 65, 0, 135, 121, 75, 0, 125, 0, 0, 0, 135, 121, 76, 0, 1, 42, 0, 0, 2, 121, 0, 0, 232, 187, 65, 0, 82, 0, 121, 0, 2, 121, 0, 0, 236, 187, 65, 0, 82, 112, 121, 0, 33, 121, 0, 0, 1, 125, 0, 0, 15, 125, 125, 112, 19, 121, 121, 125, 120, 121, 3, 0, 137, 1, 0, 0, 139, 42, 0, 0, 1, 26, 0, 0, 0, 114, 0, 0, 0, 0, 112, 0, 41, 121, 26, 2, 94, 112, 114, 121, 120, 112, 3, 0, 0, 115, 0, 0, 119, 0, 70, 0, 1, 121, 4, 1, 94, 110, 112, 121, 121, 110, 36, 0, 135, 121, 77, 0, 110, 0, 0, 0, 121, 121, 30, 0, 1, 121, 200, 29, 3, 24, 1, 121, 25, 25, 24, 64, 1, 121, 0, 0, 83, 24, 121, 0, 25, 24, 24, 1, 54, 121, 24, 25, 232, 103, 0, 0, 135, 110, 78, 0, 1, 125, 0, 0, 82, 123, 110, 0, 4, 125, 125, 123, 1, 123, 200, 29, 3, 123, 1, 123, 1, 127, 64, 0, 135, 121, 11, 0, 125, 123, 127, 0, 1, 121, 248, 26, 1, 127, 200, 29, 3, 127, 1, 127, 97, 1, 121, 127, 1, 121, 0, 0, 1, 123, 16, 0, 2, 125, 0, 0, 208, 103, 10, 0, 1, 124, 248, 26, 3, 124, 1, 124, 135, 127, 5, 0, 121, 123, 125, 124, 1, 127, 4, 1, 1, 124, 0, 0, 97, 112, 127, 124, 1, 127, 184, 0, 3, 127, 112, 127, 135, 124, 73, 0, 127, 0, 0, 0, 1, 127, 40, 1, 3, 127, 112, 127, 135, 124, 73, 0, 127, 0, 0, 0, 1, 127, 76, 1, 3, 127, 112, 127, 135, 124, 73, 0, 127, 0, 0, 0, 1, 127, 24, 1, 3, 127, 112, 127, 135, 124, 79, 0, 127, 0, 0, 0, 1, 127, 28, 1, 3, 127, 112, 127, 135, 124, 79, 0, 127, 0, 0, 0, 1, 127, 32, 1, 3, 127, 112, 127, 135, 124, 79, 0, 127, 0, 0, 0, 1, 127, 36, 1, 3, 127, 112, 127, 135, 124, 79, 0, 127, 0, 0, 0, 2, 124, 0, 0, 236, 187, 65, 0, 82, 115, 124, 0, 25, 110, 26, 1, 56, 124, 115, 110, 252, 104, 0, 0, 0, 26, 110, 0, 2, 124, 0, 0, 232, 187, 65, 0, 82, 114, 124, 0, 0, 0, 115, 0, 119, 0, 174, 255, 137, 1, 0, 0, 139, 42, 0, 0, 140, 2, 146, 0, 0, 0, 0, 0, 2, 134, 0, 0, 176, 0, 0, 0, 2, 135, 0, 0, 192, 0, 0, 0, 2, 136, 0, 0, 232, 2, 0, 0, 1, 2, 0, 0, 136, 137, 0, 0, 0, 3, 137, 0, 136, 137, 0, 0, 1, 138, 128, 3, 3, 137, 137, 138, 137, 137, 0, 0, 106, 137, 0, 16, 1, 138, 0, 0, 1, 139, 0, 0, 1, 140, 1, 0, 135, 4, 33, 0, 137, 138, 139, 140, 135, 5, 2, 0, 106, 6, 0, 24, 1, 140, 88, 4, 94, 7, 0, 140, 1, 140, 88, 4, 3, 140, 0, 140, 106, 8, 140, 4, 1, 140, 80, 4, 94, 9, 0, 140, 1, 140, 80, 4, 3, 140, 0, 140, 106, 10, 140, 4, 106, 140, 0, 4, 106, 140, 140, 20, 106, 139, 0, 12, 2, 138, 0, 0, 211, 113, 11, 0, 135, 11, 80, 0, 140, 139, 138, 0, 2, 139, 0, 0, 227, 113, 11, 0, 2, 140, 0, 0, 65, 62, 13, 0, 1, 137, 1, 0, 135, 138, 81, 0, 0, 139, 140, 137, 32, 138, 7, 0, 32, 137, 8, 0, 19, 138, 138, 137, 121, 138, 45, 0, 106, 138, 0, 4, 82, 12, 138, 0, 2, 137, 0, 0, 49, 60, 12, 0, 135, 138, 19, 0, 12, 137, 0, 0, 121, 138, 28, 0, 2, 137, 0, 0, 212, 227, 11, 0, 135, 138, 19, 0, 12, 137, 0, 0, 32, 13, 138, 0, 2, 137, 0, 0, 238, 113, 11, 0, 135, 138, 19, 0, 12, 137, 0, 0, 121, 138, 18, 0, 2, 14, 0, 0, 64, 75, 76, 0, 1, 15, 0, 0, 2, 138, 0, 0, 128, 74, 93, 5, 2, 137, 0, 0, 64, 75, 76, 0, 125, 16, 13, 138, 137, 0, 0, 0, 2, 17, 0, 0, 128, 195, 201, 1, 1, 137, 0, 0, 1, 138, 0, 0, 125, 18, 13, 137, 138, 0, 0, 0, 1, 19, 0, 0, 119, 0, 17, 0, 2, 14, 0, 0, 64, 75, 76, 0, 1, 15, 0, 0, 2, 16, 0, 0, 192, 207, 106, 0, 2, 17, 0, 0, 128, 195, 201, 1, 1, 18, 0, 0, 1, 19, 0, 0, 119, 0, 7, 0, 0, 14, 7, 0, 0, 15, 8, 0, 0, 16, 7, 0, 0, 17, 7, 0, 0, 18, 8, 0, 0, 19, 8, 0, 106, 8, 0, 16, 121, 8, 36, 0, 1, 138, 0, 0, 1, 137, 0, 0, 1, 140, 1, 0, 135, 7, 33, 0, 8, 138, 137, 140, 135, 8, 2, 0, 106, 13, 0, 16, 106, 12, 13, 104, 25, 140, 13, 104, 106, 20, 140, 4, 106, 21, 13, 112, 106, 13, 0, 24, 1, 140, 144, 1, 97, 3, 140, 7, 1, 140, 144, 1, 3, 140, 3, 140, 109, 140, 4, 8, 1, 140, 144, 1, 3, 140, 3, 140, 25, 8, 140, 8, 85, 8, 12, 0, 109, 8, 4, 20, 1, 140, 144, 1, 3, 140, 3, 140, 109, 140, 16, 21, 1, 140, 144, 1, 3, 140, 3, 140, 109, 140, 20, 13, 1, 137, 48, 0, 2, 138, 0, 0, 245, 113, 11, 0, 1, 139, 144, 1, 3, 139, 3, 139, 135, 140, 5, 0, 0, 137, 138, 139, 106, 140, 0, 24, 120, 140, 3, 0, 1, 2, 61, 0, 119, 0, 58, 1, 1, 13, 0, 0, 1, 139, 0, 0, 97, 3, 136, 139, 106, 139, 0, 28, 41, 140, 13, 2, 94, 21, 139, 140, 1, 139, 184, 2, 94, 20, 21, 139, 106, 8, 20, 16, 94, 139, 21, 134, 82, 139, 139, 0, 1, 138, 0, 0, 1, 140, 4, 0, 138, 139, 138, 140, 140, 107, 0, 0, 132, 107, 0, 0, 132, 107, 0, 0, 192, 107, 0, 0, 0, 22, 20, 0, 119, 0, 15, 0, 106, 140, 8, 76, 120, 140, 10, 0, 25, 140, 21, 16, 106, 12, 140, 4, 106, 138, 21, 16, 109, 8, 76, 138, 25, 138, 8, 76, 109, 138, 4, 12, 1, 138, 184, 2, 94, 22, 21, 138, 119, 0, 4, 0, 0, 22, 20, 0, 119, 0, 2, 0, 119, 0, 243, 255, 106, 20, 21, 8, 106, 12, 20, 16, 25, 7, 22, 24, 82, 139, 7, 0, 46, 139, 12, 139, 240, 107, 0, 0, 94, 23, 21, 134, 109, 23, 4, 12, 25, 139, 20, 8, 116, 23, 139, 0, 85, 7, 12, 0, 1, 139, 232, 0, 94, 139, 21, 139, 120, 139, 51, 0, 1, 139, 72, 4, 94, 139, 0, 139, 38, 139, 139, 32, 120, 139, 47, 0, 1, 139, 184, 1, 94, 139, 21, 139, 34, 139, 139, 1, 121, 139, 43, 0, 94, 139, 21, 134, 106, 139, 139, 4, 135, 12, 82, 0, 139, 0, 0, 0, 1, 139, 232, 0, 97, 21, 139, 12, 1, 139, 228, 0, 94, 7, 21, 139, 120, 12, 17, 0, 120, 7, 2, 0, 119, 0, 32, 0, 94, 139, 21, 134, 106, 139, 139, 4, 135, 20, 9, 0, 139, 0, 0, 0, 1, 139, 168, 1, 97, 3, 139, 20, 1, 138, 40, 0, 2, 140, 0, 0, 82, 108, 11, 0, 1, 137, 168, 1, 3, 137, 3, 137, 135, 139, 5, 0, 0, 138, 140, 137, 119, 0, 18, 0, 1, 139, 2, 0, 1, 137, 4, 0, 138, 7, 139, 137, 160, 108, 0, 0, 156, 108, 0, 0, 156, 108, 0, 0, 176, 108, 0, 0, 119, 0, 10, 0, 94, 137, 12, 134, 39, 137, 137, 1, 97, 12, 134, 137, 119, 0, 6, 0, 94, 139, 12, 134, 1, 140, 0, 16, 20, 139, 139, 140, 97, 12, 134, 139, 119, 0, 1, 0, 94, 12, 21, 134, 106, 7, 12, 4, 1, 139, 184, 2, 94, 139, 21, 139, 25, 20, 139, 24, 82, 139, 20, 0, 46, 139, 7, 139, 232, 108, 0, 0, 85, 20, 7, 0, 135, 24, 83, 0, 8, 12, 0, 0, 34, 139, 24, 0, 121, 139, 3, 0, 1, 2, 56, 0, 119, 0, 165, 0, 1, 139, 184, 1, 94, 139, 21, 139, 34, 139, 139, 1, 121, 139, 5, 0, 1, 139, 184, 2, 94, 139, 21, 139, 1, 137, 1, 0, 109, 139, 20, 137, 94, 12, 21, 134, 106, 7, 12, 4, 32, 137, 7, 27, 121, 137, 6, 0, 2, 137, 0, 0, 134, 228, 11, 0, 135, 25, 84, 0, 137, 0, 0, 0, 119, 0, 68, 0, 106, 137, 21, 8, 106, 20, 137, 12, 120, 20, 32, 0, 82, 137, 12, 0, 1, 139, 0, 0, 1, 140, 4, 0, 138, 137, 139, 140, 116, 109, 0, 0, 136, 109, 0, 0, 112, 109, 0, 0, 156, 109, 0, 0, 119, 0, 16, 0, 1, 139, 20, 5, 94, 23, 0, 139, 121, 23, 13, 0, 0, 26, 23, 0, 119, 0, 19, 0, 1, 139, 24, 5, 94, 23, 0, 139, 121, 23, 8, 0, 0, 26, 23, 0, 119, 0, 14, 0, 1, 139, 28, 5, 94, 23, 0, 139, 121, 23, 3, 0, 0, 26, 23, 0, 119, 0, 9, 0, 135, 23, 85, 0, 7, 0, 0, 0, 120, 23, 3, 0, 1, 25, 0, 0, 119, 0, 36, 0, 0, 26, 23, 0, 119, 0, 2, 0, 0, 26, 20, 0, 106, 137, 26, 16, 2, 139, 0, 0, 0, 0, 2, 0, 19, 137, 137, 139, 120, 137, 3, 0, 0, 25, 26, 0, 119, 0, 26, 0, 1, 137, 0, 0, 135, 20, 86, 0, 137, 0, 0, 0, 120, 20, 3, 0, 0, 25, 26, 0, 119, 0, 20, 0, 0, 23, 20, 0, 106, 137, 23, 12, 45, 137, 137, 7, 60, 110, 0, 0, 135, 137, 87, 0, 23, 0, 0, 0, 121, 137, 8, 0, 106, 137, 23, 16, 2, 139, 0, 0, 0, 2, 2, 0, 19, 137, 137, 139, 120, 137, 3, 0, 0, 25, 23, 0, 119, 0, 6, 0, 135, 23, 86, 0, 23, 0, 0, 0, 120, 23, 241, 255, 0, 25, 26, 0, 119, 0, 1, 0, 121, 1, 5, 0, 41, 139, 13, 2, 3, 139, 1, 139, 0, 137, 139, 0, 119, 0, 3, 0, 3, 139, 3, 136, 0, 137, 139, 0, 0, 7, 137, 0, 2, 139, 0, 0, 153, 55, 13, 0, 2, 140, 0, 0, 65, 62, 13, 0, 1, 138, 0, 0, 135, 137, 4, 0, 7, 139, 140, 138, 1, 137, 4, 5, 94, 12, 0, 137, 121, 12, 6, 0, 2, 138, 0, 0, 199, 63, 12, 0, 1, 140, 0, 0, 135, 137, 4, 0, 7, 138, 12, 140, 33, 12, 25, 0, 94, 137, 21, 134, 82, 137, 137, 0, 32, 137, 137, 3, 19, 137, 12, 137, 121, 137, 18, 0, 106, 137, 8, 12, 120, 137, 16, 0, 135, 137, 8, 0, 8, 25, 7, 0, 34, 137, 137, 0, 121, 137, 12, 0, 1, 137, 176, 1, 2, 140, 0, 0, 102, 114, 11, 0, 97, 3, 137, 140, 1, 137, 24, 0, 2, 138, 0, 0, 74, 114, 11, 0, 1, 139, 176, 1, 3, 139, 3, 139, 135, 140, 5, 0, 0, 137, 138, 139, 1, 139, 0, 0, 135, 140, 88, 0, 21, 139, 0, 0, 120, 140, 23, 0, 1, 140, 184, 1, 94, 140, 21, 140, 34, 140, 140, 1, 19, 140, 12, 140, 121, 140, 18, 0, 106, 140, 8, 12, 120, 140, 16, 0, 135, 140, 8, 0, 8, 25, 7, 0, 34, 140, 140, 0, 121, 140, 12, 0, 1, 140, 184, 1, 2, 139, 0, 0, 102, 114, 11, 0, 97, 3, 140, 139, 1, 140, 24, 0, 2, 138, 0, 0, 74, 114, 11, 0, 1, 137, 184, 1, 3, 137, 3, 137, 135, 139, 5, 0, 0, 140, 138, 137, 120, 1, 4, 0, 3, 137, 3, 136, 135, 139, 79, 0, 137, 0, 0, 0, 25, 13, 13, 1, 106, 27, 0, 24, 55, 139, 13, 27, 64, 107, 0, 0, 32, 139, 2, 56, 121, 139, 5, 0, 0, 28, 24, 0, 1, 29, 0, 0, 1, 2, 226, 1, 119, 0, 31, 0, 120, 27, 3, 0, 1, 2, 61, 0, 119, 0, 28, 0, 106, 13, 0, 28, 1, 7, 0, 0, 41, 139, 7, 2, 94, 139, 13, 139, 1, 137, 180, 0, 94, 12, 139, 137, 1, 139, 0, 0, 85, 12, 139, 0, 2, 137, 0, 0, 0, 0, 0, 128, 109, 12, 4, 137, 1, 139, 0, 0, 109, 12, 72, 139, 25, 139, 12, 72, 2, 137, 0, 0, 0, 0, 0, 128, 109, 139, 4, 137, 1, 139, 0, 0, 109, 12, 88, 139, 25, 139, 12, 88, 2, 137, 0, 0, 0, 0, 0, 128, 109, 139, 4, 137, 25, 7, 7, 1, 53, 137, 7, 27, 188, 111, 0, 0, 1, 2, 61, 0, 32, 137, 2, 61, 121, 137, 32, 17, 1, 139, 160, 4, 3, 139, 0, 139, 135, 137, 89, 0, 139, 0, 0, 0, 120, 137, 199, 6, 1, 137, 0, 1, 3, 137, 3, 137, 25, 27, 137, 16, 1, 24, 0, 0, 1, 25, 0, 0, 1, 26, 0, 0, 15, 137, 25, 10, 13, 139, 25, 10, 16, 138, 26, 9, 19, 139, 139, 138, 20, 137, 137, 139, 0, 22, 137, 0, 106, 137, 0, 24, 120, 137, 3, 0, 1, 30, 0, 0, 119, 0, 148, 1, 1, 7, 0, 0, 106, 137, 0, 28, 41, 139, 7, 2, 94, 13, 137, 139, 1, 139, 0, 0, 135, 137, 88, 0, 13, 139, 0, 0, 120, 137, 3, 0, 0, 30, 7, 0, 119, 0, 138, 1, 106, 137, 13, 16, 76, 137, 137, 0, 106, 139, 13, 20, 76, 139, 139, 0, 66, 137, 137, 139, 62, 139, 0, 0, 252, 169, 241, 210, 77, 98, 64, 63, 73, 137, 137, 139, 1, 139, 40, 0, 1, 138, 20, 0, 125, 12, 137, 139, 138, 0, 0, 0, 1, 138, 184, 2, 94, 23, 13, 138, 106, 20, 23, 16, 106, 31, 20, 80, 106, 32, 20, 76, 34, 138, 32, 0, 41, 138, 138, 31, 42, 138, 138, 31, 0, 33, 138, 0, 1, 138, 101, 0, 1, 139, 0, 0, 135, 34, 90, 0, 32, 33, 138, 139, 135, 35, 2, 0, 1, 139, 5, 0, 1, 138, 0, 0, 135, 36, 90, 0, 32, 33, 139, 138, 135, 33, 2, 0, 34, 138, 31, 0, 41, 138, 138, 31, 42, 138, 138, 31, 15, 138, 35, 138, 34, 139, 31, 0, 41, 139, 139, 31, 42, 139, 139, 31, 13, 139, 35, 139, 18, 137, 34, 31, 19, 139, 139, 137, 20, 138, 138, 139, 34, 139, 31, 0, 41, 139, 139, 31, 42, 139, 139, 31, 15, 139, 139, 33, 34, 137, 31, 0, 41, 137, 137, 31, 42, 137, 137, 31, 13, 137, 33, 137, 16, 140, 31, 36, 19, 137, 137, 140, 20, 139, 139, 137, 20, 138, 138, 139, 121, 138, 3, 0, 1, 2, 72, 0, 119, 0, 191, 0, 106, 138, 20, 20, 2, 139, 0, 0, 109, 112, 52, 118, 45, 138, 138, 139, 168, 113, 0, 0, 1, 2, 72, 0, 119, 0, 184, 0, 106, 138, 20, 16, 1, 139, 2, 0, 1, 137, 172, 0, 138, 138, 139, 137, 112, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 120, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 124, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 104, 116, 0, 0, 128, 116, 0, 0, 1, 37, 0, 0, 119, 0, 6, 0, 1, 2, 72, 0, 119, 0, 4, 0, 119, 0, 254, 255, 119, 0, 253, 255, 119, 0, 252, 255, 32, 138, 2, 72, 121, 138, 3, 0, 1, 2, 0, 0, 0, 37, 12, 0, 1, 138, 152, 4, 94, 12, 0, 138, 106, 139, 13, 48, 1, 137, 0, 4, 19, 139, 139, 137, 32, 139, 139, 0, 121, 139, 7, 0, 1, 137, 255, 255, 15, 137, 137, 12, 125, 139, 137, 12, 37, 0, 0, 0, 0, 138, 139, 0, 119, 0, 3, 0, 1, 139, 0, 0, 0, 138, 139, 0, 0, 31, 138, 0, 1, 138, 180, 0, 94, 12, 13, 138, 106, 138, 0, 4, 106, 138, 138, 8, 1, 139, 128, 0, 19, 138, 138, 139, 120, 138, 3, 0, 106, 38, 12, 16, 119, 0, 10, 0, 106, 138, 12, 48, 25, 139, 12, 48, 106, 139, 139, 4, 1, 137, 2, 0, 1, 140, 0, 0, 135, 36, 91, 0, 138, 139, 137, 140, 135, 140, 2, 0, 0, 38, 36, 0, 1, 140, 164, 0, 94, 140, 13, 140, 120, 140, 3, 0, 1, 2, 78, 0, 119, 0, 4, 0, 106, 140, 13, 68, 120, 140, 2, 0, 1, 2, 78, 0, 32, 140, 2, 78, 121, 140, 14, 0, 1, 2, 0, 0, 47, 137, 38, 31, 100, 117, 0, 0, 94, 137, 13, 134, 82, 137, 137, 0, 32, 137, 137, 0, 0, 140, 137, 0, 119, 0, 3, 0, 1, 137, 0, 0, 0, 140, 137, 0, 121, 140, 3, 0, 0, 30, 7, 0, 119, 0, 85, 0, 34, 140, 38, 2, 106, 137, 12, 56, 33, 137, 137, 0, 19, 140, 140, 137, 121, 140, 6, 0, 1, 140, 140, 0, 94, 140, 20, 140, 120, 140, 3, 0, 0, 30, 7, 0, 119, 0, 75, 0, 106, 140, 20, 68, 120, 140, 29, 0, 106, 140, 23, 36, 121, 140, 4, 0, 106, 140, 23, 28, 120, 140, 2, 0, 119, 0, 24, 0, 2, 140, 0, 0, 141, 114, 11, 0, 135, 12, 92, 0, 140, 0, 0, 0, 121, 12, 19, 0, 106, 31, 12, 4, 120, 31, 2, 0, 119, 0, 16, 0, 82, 12, 31, 0, 120, 12, 2, 0, 119, 0, 13, 0, 94, 140, 13, 134, 106, 36, 140, 4, 0, 33, 31, 0, 0, 31, 12, 0, 25, 33, 33, 4, 45, 140, 31, 36, 12, 118, 0, 0, 0, 30, 7, 0, 119, 0, 48, 0, 82, 31, 33, 0, 33, 140, 31, 0, 120, 140, 249, 255, 94, 137, 13, 135, 32, 137, 137, 0, 121, 137, 8, 0, 3, 137, 13, 135, 106, 137, 137, 4, 2, 139, 0, 0, 0, 0, 0, 128, 13, 137, 137, 139, 0, 140, 137, 0, 119, 0, 3, 0, 1, 137, 0, 0, 0, 140, 137, 0, 121, 140, 24, 0, 106, 140, 0, 4, 106, 140, 140, 8, 1, 137, 128, 0, 19, 140, 140, 137, 120, 140, 19, 0, 106, 140, 13, 48, 1, 137, 0, 4, 19, 140, 140, 137, 120, 140, 4, 0, 1, 140, 192, 4, 94, 39, 0, 140, 119, 0, 2, 0, 1, 39, 1, 0, 1, 140, 224, 0, 94, 140, 13, 140, 56, 140, 39, 140, 168, 118, 0, 0, 94, 140, 13, 134, 82, 140, 140, 0, 35, 140, 140, 2, 121, 140, 3, 0, 0, 30, 7, 0, 119, 0, 9, 0, 25, 13, 7, 1, 106, 140, 0, 24, 48, 140, 13, 140, 192, 118, 0, 0, 0, 7, 13, 0, 119, 0, 113, 254, 0, 30, 13, 0, 119, 0, 1, 0, 120, 11, 3, 0, 1, 2, 99, 0, 119, 0, 6, 0, 82, 140, 11, 0, 120, 140, 3, 0, 1, 2, 99, 0, 119, 0, 2, 0, 1, 40, 0, 0, 32, 140, 2, 99, 121, 140, 13, 0, 1, 2, 0, 0, 106, 140, 0, 24, 45, 140, 30, 140, 28, 119, 0, 0, 106, 140, 0, 20, 38, 140, 140, 1, 120, 140, 3, 0, 1, 2, 101, 0, 119, 0, 134, 3, 1, 40, 1, 0, 119, 0, 2, 0, 1, 40, 0, 0, 120, 22, 3, 0, 1, 2, 103, 0, 119, 0, 128, 3, 1, 140, 0, 1, 3, 140, 3, 140, 134, 41, 0, 0, 28, 5, 1, 0, 0, 140, 0, 0, 33, 140, 41, 245, 120, 140, 9, 0, 1, 137, 160, 4, 3, 137, 0, 137, 135, 140, 89, 0, 137, 0, 0, 0, 121, 140, 69, 254, 0, 42, 24, 0, 1, 2, 65, 0, 119, 0, 254, 4, 34, 140, 41, 0, 121, 140, 3, 0, 1, 2, 202, 0, 119, 0, 109, 3, 1, 140, 72, 4, 94, 140, 0, 140, 38, 140, 140, 64, 120, 140, 29, 0, 1, 140, 12, 5, 94, 22, 0, 140, 1, 140, 80, 0, 135, 7, 93, 0, 140, 0, 0, 0, 120, 7, 5, 0, 1, 28, 244, 255, 0, 29, 24, 0, 1, 2, 226, 1, 119, 0, 62, 15, 0, 43, 7, 0, 1, 140, 0, 1, 3, 13, 3, 140, 25, 44, 43, 72, 116, 43, 13, 0, 25, 43, 43, 4, 25, 13, 13, 4, 54, 140, 43, 44, 192, 119, 0, 0, 106, 140, 22, 4, 120, 140, 3, 0, 109, 22, 4, 7, 119, 0, 3, 0, 106, 140, 22, 8, 109, 140, 72, 7, 109, 22, 8, 7, 1, 45, 0, 0, 119, 0, 2, 0, 0, 45, 41, 0, 106, 140, 0, 28], eb + 20480);
                HEAPU8.set([1, 137, 0, 1, 3, 137, 3, 137, 106, 137, 137, 32, 41, 137, 137, 2, 94, 13, 140, 137, 106, 140, 13, 48, 1, 137, 0, 4, 19, 140, 140, 137, 32, 23, 140, 0, 1, 140, 0, 1, 3, 140, 3, 140, 106, 20, 140, 28, 1, 137, 0, 0, 125, 140, 23, 20, 137, 0, 0, 0, 121, 23, 6, 0, 34, 139, 20, 0, 41, 139, 139, 31, 42, 139, 139, 31, 0, 137, 139, 0, 119, 0, 3, 0, 1, 139, 0, 0, 0, 137, 139, 0, 135, 26, 44, 0, 140, 137, 26, 25, 135, 25, 2, 0, 1, 137, 184, 2, 94, 20, 13, 137, 106, 23, 20, 16, 106, 137, 20, 20, 120, 137, 16, 0, 94, 137, 13, 134, 135, 20, 83, 0, 23, 137, 0, 0, 34, 137, 20, 0, 121, 137, 5, 0, 0, 28, 20, 0, 0, 29, 24, 0, 1, 2, 226, 1, 119, 0, 2, 15, 1, 137, 184, 2, 94, 137, 13, 137, 1, 140, 1, 0, 109, 137, 20, 140, 0, 46, 20, 0, 119, 0, 2, 0, 0, 46, 45, 0, 82, 20, 27, 0, 106, 31, 27, 4, 1, 140, 224, 0, 94, 33, 13, 140, 32, 140, 20, 0, 2, 137, 0, 0, 0, 0, 0, 128, 13, 137, 31, 137, 19, 140, 140, 137, 121, 140, 4, 0, 0, 47, 33, 0, 1, 2, 134, 0, 119, 0, 182, 0, 1, 140, 1, 0, 47, 140, 140, 33, 196, 123, 0, 0, 1, 140, 180, 0, 94, 36, 13, 140, 106, 12, 36, 88, 25, 140, 36, 88, 106, 34, 140, 4, 32, 140, 12, 0, 2, 137, 0, 0, 0, 0, 0, 128, 13, 137, 34, 137, 19, 140, 140, 137, 15, 137, 34, 31, 13, 139, 34, 31, 16, 138, 12, 20, 19, 139, 139, 138, 20, 137, 137, 139, 20, 140, 140, 137, 121, 140, 90, 0, 32, 140, 12, 0, 2, 137, 0, 0, 0, 0, 0, 128, 13, 137, 34, 137, 19, 140, 140, 137, 121, 140, 3, 0, 0, 48, 36, 0, 119, 0, 124, 0, 106, 35, 36, 96, 106, 32, 36, 80, 47, 140, 32, 35, 156, 122, 0, 0, 82, 49, 27, 0, 106, 50, 27, 4, 135, 51, 20, 0, 49, 50, 12, 34, 135, 140, 2, 0, 1, 137, 232, 3, 1, 139, 0, 0, 135, 52, 94, 0, 51, 140, 137, 139, 135, 51, 2, 0, 106, 139, 36, 72, 25, 137, 36, 72, 106, 137, 137, 4, 135, 53, 20, 0, 12, 34, 139, 137, 4, 54, 35, 32, 135, 137, 2, 0, 34, 139, 54, 0, 41, 139, 139, 31, 42, 139, 139, 31, 135, 32, 94, 0, 53, 137, 54, 139, 135, 54, 2, 0, 16, 139, 54, 51, 13, 137, 51, 54, 16, 140, 32, 52, 19, 137, 137, 140, 20, 139, 139, 137, 121, 139, 45, 0, 1, 139, 224, 0, 94, 32, 13, 139, 1, 139, 0, 2, 82, 137, 13, 0, 97, 3, 139, 137, 1, 137, 0, 2, 3, 137, 3, 137, 109, 137, 4, 35, 1, 137, 0, 2, 3, 137, 3, 137, 25, 35, 137, 8, 85, 35, 12, 0, 109, 35, 4, 34, 1, 137, 0, 2, 3, 137, 3, 137, 109, 137, 16, 32, 1, 137, 0, 2, 3, 137, 3, 137, 25, 32, 137, 24, 85, 32, 49, 0, 109, 32, 4, 50, 1, 139, 24, 0, 2, 140, 0, 0, 135, 115, 11, 0, 1, 138, 0, 2, 3, 138, 3, 138, 135, 137, 5, 0, 0, 139, 140, 138, 1, 137, 180, 0, 94, 50, 13, 137, 1, 138, 0, 0, 109, 50, 88, 138, 25, 138, 50, 88, 2, 137, 0, 0, 0, 0, 0, 128, 109, 138, 4, 137, 1, 138, 0, 0, 109, 50, 72, 138, 25, 138, 50, 72, 2, 137, 0, 0, 0, 0, 0, 128, 109, 138, 4, 137, 0, 48, 50, 0, 119, 0, 47, 0, 0, 48, 36, 0, 119, 0, 45, 0, 0, 48, 36, 0, 119, 0, 43, 0, 106, 50, 36, 96, 1, 137, 224, 1, 82, 138, 13, 0, 97, 3, 137, 138, 1, 138, 224, 1, 3, 138, 3, 138, 109, 138, 4, 50, 1, 138, 224, 1, 3, 138, 3, 138, 25, 50, 138, 8, 85, 50, 12, 0, 109, 50, 4, 34, 1, 138, 224, 1, 3, 138, 3, 138, 109, 138, 16, 33, 1, 138, 224, 1, 3, 138, 3, 138, 25, 33, 138, 24, 85, 33, 20, 0, 109, 33, 4, 31, 1, 137, 48, 0, 2, 140, 0, 0, 52, 115, 11, 0, 1, 139, 224, 1, 3, 139, 3, 139, 135, 138, 5, 0, 0, 137, 140, 139, 1, 138, 180, 0, 94, 31, 13, 138, 1, 139, 0, 0, 109, 31, 88, 139, 25, 139, 31, 88, 2, 138, 0, 0, 0, 0, 0, 128, 109, 139, 4, 138, 1, 139, 0, 0, 109, 31, 72, 139, 25, 139, 31, 72, 2, 138, 0, 0, 0, 0, 0, 128, 109, 139, 4, 138, 0, 48, 31, 0, 25, 31, 48, 72, 82, 33, 27, 0, 106, 20, 27, 4, 82, 139, 31, 0, 32, 139, 139, 0, 121, 139, 7, 0, 106, 139, 31, 4, 2, 140, 0, 0, 0, 0, 0, 128, 13, 139, 139, 140, 0, 138, 139, 0, 119, 0, 3, 0, 1, 139, 0, 0, 0, 138, 139, 0, 121, 138, 8, 0, 85, 31, 33, 0, 109, 31, 4, 20, 1, 138, 224, 0, 94, 31, 13, 138, 109, 48, 80, 31, 0, 55, 31, 0, 119, 0, 3, 0, 1, 138, 224, 0, 94, 55, 13, 138, 25, 31, 48, 88, 85, 31, 33, 0, 109, 31, 4, 20, 109, 48, 96, 55, 0, 47, 55, 0, 1, 2, 134, 0, 1, 138, 134, 0, 45, 138, 2, 138, 156, 129, 0, 0, 1, 2, 0, 0, 1, 138, 1, 0, 47, 138, 138, 47, 156, 129, 0, 0, 1, 138, 0, 0, 106, 139, 13, 20, 47, 138, 138, 139, 108, 124, 0, 0, 1, 138, 180, 0, 94, 138, 13, 138, 25, 20, 138, 40, 82, 31, 20, 0, 106, 33, 20, 4, 1, 138, 120, 3, 1, 139, 1, 0, 97, 3, 138, 139, 1, 139, 120, 3, 3, 139, 3, 139, 25, 20, 139, 4, 2, 139, 0, 0, 64, 66, 15, 0, 85, 20, 139, 0, 25, 139, 13, 16, 116, 3, 139, 0, 25, 138, 13, 16, 106, 138, 138, 4, 109, 3, 4, 138, 1, 139, 120, 3, 94, 139, 3, 139, 97, 3, 136, 139, 3, 139, 3, 136, 82, 138, 20, 0, 109, 139, 4, 138, 3, 138, 3, 136, 135, 20, 34, 0, 31, 33, 3, 138, 135, 56, 2, 0, 0, 57, 20, 0, 119, 0, 3, 0, 1, 56, 0, 0, 1, 57, 0, 0, 106, 20, 13, 68, 1, 138, 0, 0, 47, 138, 138, 20, 212, 125, 0, 0, 1, 138, 224, 0, 94, 33, 13, 138, 1, 138, 112, 3, 106, 139, 13, 72, 97, 3, 138, 139, 1, 139, 112, 3, 3, 139, 3, 139, 25, 31, 139, 4, 85, 31, 20, 0, 1, 139, 104, 3, 1, 138, 1, 0, 97, 3, 139, 138, 1, 138, 104, 3, 3, 138, 3, 138, 25, 20, 138, 4, 2, 138, 0, 0, 64, 66, 15, 0, 85, 20, 138, 0, 1, 138, 112, 3, 3, 138, 3, 138, 116, 3, 138, 0, 82, 139, 31, 0, 109, 3, 4, 139, 1, 138, 104, 3, 94, 138, 3, 138, 97, 3, 136, 138, 3, 138, 3, 136, 82, 139, 20, 0, 109, 138, 4, 139, 34, 139, 33, 0, 41, 139, 139, 31, 42, 139, 139, 31, 3, 138, 3, 136, 135, 20, 34, 0, 33, 139, 3, 138, 135, 33, 2, 0, 15, 138, 33, 56, 13, 139, 56, 33, 16, 140, 20, 57, 19, 139, 139, 140, 20, 138, 138, 139, 121, 138, 4, 0, 0, 58, 57, 0, 0, 59, 56, 0, 119, 0, 42, 0, 1, 138, 224, 0, 94, 20, 13, 138, 106, 33, 13, 68, 1, 138, 96, 3, 106, 139, 13, 72, 97, 3, 138, 139, 1, 139, 96, 3, 3, 139, 3, 139, 25, 31, 139, 4, 85, 31, 33, 0, 1, 139, 88, 3, 1, 138, 1, 0, 97, 3, 139, 138, 1, 138, 88, 3, 3, 138, 3, 138, 25, 33, 138, 4, 2, 138, 0, 0, 64, 66, 15, 0, 85, 33, 138, 0, 1, 138, 96, 3, 3, 138, 3, 138, 116, 3, 138, 0, 82, 139, 31, 0, 109, 3, 4, 139, 1, 138, 88, 3, 94, 138, 3, 138, 97, 3, 136, 138, 3, 138, 3, 136, 82, 139, 33, 0, 109, 138, 4, 139, 34, 139, 20, 0, 41, 139, 139, 31, 42, 139, 139, 31, 3, 138, 3, 136, 135, 33, 34, 0, 20, 139, 3, 138, 0, 58, 33, 0, 135, 59, 2, 0, 119, 0, 3, 0, 0, 58, 57, 0, 0, 59, 56, 0, 32, 138, 58, 0, 32, 139, 59, 0, 19, 138, 138, 139, 121, 138, 104, 0, 1, 138, 30, 0, 1, 139, 224, 0, 94, 139, 13, 139, 47, 138, 138, 139, 124, 127, 0, 0, 1, 138, 180, 0, 94, 33, 13, 138, 106, 20, 33, 72, 25, 138, 33, 72, 106, 31, 138, 4, 32, 138, 20, 0, 2, 139, 0, 0, 0, 0, 0, 128, 13, 139, 31, 139, 19, 138, 138, 139, 121, 138, 4, 0, 1, 60, 0, 0, 1, 61, 0, 0, 119, 0, 87, 0, 106, 34, 33, 88, 25, 138, 33, 88, 106, 50, 138, 4, 32, 138, 34, 0, 2, 139, 0, 0, 0, 0, 0, 128, 13, 139, 50, 139, 19, 138, 138, 139, 121, 138, 4, 0, 1, 60, 0, 0, 1, 61, 0, 0, 119, 0, 75, 0, 135, 33, 20, 0, 34, 50, 20, 31, 135, 31, 2, 0, 1, 138, 80, 3, 1, 139, 1, 0, 97, 3, 138, 139, 1, 139, 80, 3, 3, 139, 3, 139, 25, 20, 139, 4, 2, 139, 0, 0, 64, 66, 15, 0, 85, 20, 139, 0, 25, 139, 13, 16, 116, 3, 139, 0, 25, 138, 13, 16, 106, 138, 138, 4, 109, 3, 4, 138, 1, 139, 80, 3, 94, 139, 3, 139, 97, 3, 136, 139, 3, 139, 3, 136, 82, 138, 20, 0, 109, 139, 4, 138, 3, 139, 3, 136, 135, 138, 34, 0, 33, 31, 3, 139, 135, 138, 2, 0, 34, 138, 138, 0, 121, 138, 4, 0, 1, 60, 0, 0, 1, 61, 0, 0, 119, 0, 43, 0, 1, 138, 180, 0, 94, 31, 13, 138, 106, 138, 31, 88, 25, 139, 31, 88, 106, 139, 139, 4, 106, 140, 31, 72, 25, 137, 31, 72, 106, 137, 137, 4, 135, 33, 20, 0, 138, 139, 140, 137, 135, 31, 2, 0, 1, 137, 72, 3, 1, 140, 1, 0, 97, 3, 137, 140, 1, 140, 72, 3, 3, 140, 3, 140, 25, 20, 140, 4, 2, 140, 0, 0, 64, 66, 15, 0, 85, 20, 140, 0, 25, 140, 13, 16, 116, 3, 140, 0, 25, 137, 13, 16, 106, 137, 137, 4, 109, 3, 4, 137, 1, 140, 72, 3, 94, 140, 3, 140, 97, 3, 136, 140, 3, 140, 3, 136, 82, 137, 20, 0, 109, 140, 4, 137, 3, 137, 3, 136, 135, 20, 34, 0, 33, 31, 3, 137, 135, 60, 2, 0, 0, 61, 20, 0, 119, 0, 6, 0, 1, 60, 0, 0, 1, 61, 0, 0, 119, 0, 3, 0, 0, 60, 59, 0, 0, 61, 58, 0, 120, 40, 8, 0, 106, 137, 23, 8, 32, 7, 137, 3, 125, 62, 7, 19, 18, 0, 0, 0, 125, 63, 7, 17, 16, 0, 0, 0, 119, 0, 3, 0, 0, 62, 15, 0, 0, 63, 14, 0, 15, 137, 60, 62, 13, 140, 60, 62, 16, 139, 61, 63, 19, 140, 140, 139, 20, 137, 137, 140, 120, 137, 3, 0, 1, 2, 149, 0, 119, 0, 85, 1, 1, 137, 0, 1, 3, 137, 3, 137, 25, 7, 137, 48, 82, 22, 7, 0, 106, 20, 7, 4, 32, 137, 22, 0, 32, 140, 20, 0, 19, 137, 137, 140, 120, 137, 105, 0, 106, 137, 23, 8, 32, 137, 137, 3, 121, 137, 57, 0, 1, 137, 0, 1, 3, 137, 3, 137, 25, 7, 137, 8, 82, 31, 7, 0, 106, 33, 7, 4, 32, 137, 31, 0, 2, 140, 0, 0, 0, 0, 0, 128, 13, 140, 33, 140, 19, 137, 137, 140, 121, 137, 3, 0, 1, 2, 156, 0, 119, 0, 45, 0, 106, 7, 13, 24, 25, 137, 13, 24, 106, 50, 137, 4, 32, 137, 7, 0, 2, 140, 0, 0, 0, 0, 0, 128, 13, 140, 50, 140, 19, 137, 137, 140, 15, 140, 33, 50, 13, 139, 33, 50, 16, 138, 31, 7, 19, 139, 139, 138, 20, 140, 140, 139, 20, 137, 137, 140, 121, 137, 3, 0, 1, 2, 156, 0, 119, 0, 28, 0, 135, 34, 20, 0, 31, 33, 7, 50, 135, 50, 2, 0, 1, 137, 180, 0, 94, 7, 13, 137, 25, 137, 7, 40, 25, 33, 137, 4, 106, 137, 7, 40, 82, 140, 33, 0, 135, 31, 44, 0, 137, 140, 22, 20, 135, 12, 2, 0, 15, 140, 12, 50, 13, 137, 50, 12, 16, 139, 31, 34, 19, 137, 137, 139, 20, 140, 140, 137, 0, 36, 140, 0, 125, 137, 36, 31, 34, 0, 0, 0, 109, 7, 40, 137, 125, 137, 36, 12, 50, 0, 0, 0, 85, 33, 137, 0, 0, 64, 7, 0, 119, 0, 2, 0, 1, 2, 156, 0, 1, 137, 156, 0, 45, 137, 2, 137, 44, 129, 0, 0, 1, 2, 0, 0, 1, 137, 180, 0, 94, 7, 13, 137, 25, 137, 7, 40, 25, 50, 137, 4, 106, 137, 7, 40, 82, 140, 50, 0, 135, 12, 44, 0, 137, 140, 22, 20, 135, 36, 2, 0, 109, 7, 40, 12, 85, 50, 36, 0, 0, 64, 7, 0, 1, 140, 232, 0, 94, 7, 13, 140, 120, 7, 3, 0, 1, 65, 2, 0, 119, 0, 13, 0, 1, 140, 228, 0, 94, 140, 13, 140, 120, 140, 3, 0, 1, 65, 2, 0, 119, 0, 8, 0, 106, 140, 23, 84, 33, 140, 140, 2, 121, 140, 3, 0, 1, 65, 2, 0, 119, 0, 3, 0, 106, 140, 7, 36, 25, 65, 140, 1, 25, 7, 64, 48, 82, 140, 7, 0, 106, 137, 7, 4, 34, 139, 65, 0, 41, 139, 139, 31, 42, 139, 139, 31, 135, 23, 44, 0, 140, 137, 65, 139, 135, 20, 2, 0, 85, 7, 23, 0, 109, 7, 4, 20, 94, 139, 13, 134, 82, 139, 139, 0, 120, 139, 33, 0, 1, 137, 0, 0, 82, 140, 27, 0, 106, 138, 27, 4, 135, 139, 95, 0, 137, 13, 140, 138, 82, 20, 27, 0, 106, 7, 27, 4, 1, 139, 0, 1, 3, 139, 3, 139, 25, 23, 139, 8, 82, 22, 23, 0, 106, 36, 23, 4, 32, 139, 22, 0, 2, 138, 0, 0, 0, 0, 0, 128, 13, 138, 36, 138, 19, 139, 139, 138, 32, 138, 20, 0, 2, 140, 0, 0, 0, 0, 0, 128, 13, 140, 7, 140, 19, 138, 138, 140, 13, 140, 20, 22, 13, 137, 7, 36, 19, 140, 140, 137, 20, 138, 138, 140, 20, 139, 139, 138, 120, 139, 5, 0, 1, 139, 180, 0, 94, 139, 13, 139, 1, 138, 1, 0, 109, 139, 56, 138, 1, 138, 184, 2, 94, 66, 13, 138, 106, 138, 66, 16, 106, 138, 138, 68, 120, 138, 150, 0, 106, 138, 66, 36, 120, 138, 68, 0, 2, 138, 0, 0, 141, 114, 11, 0, 135, 36, 92, 0, 138, 0, 0, 0, 121, 36, 61, 0, 2, 138, 0, 0, 141, 114, 11, 0, 135, 7, 92, 0, 138, 0, 0, 0, 121, 7, 56, 0, 106, 22, 7, 4, 121, 22, 54, 0, 82, 7, 22, 0, 120, 7, 2, 0, 119, 0, 51, 0, 94, 138, 13, 134, 106, 20, 138, 4, 0, 23, 22, 0, 0, 22, 7, 0, 25, 23, 23, 4, 52, 138, 22, 20, 168, 130, 0, 0, 82, 22, 23, 0, 120, 22, 252, 255, 119, 0, 41, 0, 135, 22, 96, 0, 109, 66, 32, 22, 120, 22, 5, 0, 1, 28, 244, 255, 0, 29, 24, 0, 1, 2, 226, 1, 119, 0, 121, 12, 25, 138, 66, 28, 135, 22, 97, 0, 36, 138, 0, 0, 34, 138, 22, 0, 121, 138, 4, 0, 0, 67, 22, 0, 1, 2, 178, 0, 119, 0, 146, 0, 106, 138, 66, 28, 106, 138, 138, 16, 94, 139, 13, 134, 135, 22, 98, 0, 138, 139, 0, 0, 34, 139, 22, 0, 121, 139, 4, 0, 0, 67, 22, 0, 1, 2, 178, 0, 119, 0, 136, 0, 25, 139, 13, 16, 106, 22, 139, 4, 106, 139, 66, 28, 25, 23, 139, 24, 25, 139, 13, 16, 116, 23, 139, 0, 109, 23, 4, 22, 106, 139, 66, 28, 135, 22, 99, 0, 139, 0, 0, 0, 34, 139, 22, 0, 121, 139, 4, 0, 0, 67, 22, 0, 1, 2, 178, 0, 119, 0, 121, 0, 1, 138, 1, 0, 109, 66, 36, 138, 106, 138, 66, 28, 121, 138, 79, 0, 106, 68, 66, 32, 1, 138, 0, 1, 3, 138, 3, 138, 135, 36, 100, 0, 68, 138, 0, 0, 34, 138, 36, 0, 121, 138, 5, 0, 0, 28, 36, 0, 0, 29, 24, 0, 1, 2, 226, 1, 119, 0, 73, 12, 106, 138, 66, 28, 135, 69, 101, 0, 138, 68, 0, 0, 34, 138, 69, 0, 121, 138, 3, 0, 1, 2, 184, 0, 119, 0, 99, 0, 106, 138, 66, 16, 106, 138, 138, 68, 120, 138, 58, 0, 106, 138, 66, 28, 135, 36, 102, 0, 138, 68, 0, 0, 34, 138, 36, 0, 121, 138, 18, 0, 34, 138, 36, 245, 121, 138, 9, 0, 2, 138, 0, 0, 187, 176, 185, 223, 1, 139, 1, 0, 138, 36, 138, 139, 228, 131, 0, 0, 0, 70, 36, 0, 119, 0, 82, 0, 119, 0, 40, 0, 1, 138, 245, 255, 1, 139, 1, 0, 138, 36, 138, 139, 0, 132, 0, 0, 0, 70, 36, 0, 119, 0, 75, 0, 119, 0, 33, 0, 1, 138, 1, 0, 3, 139, 3, 136, 135, 22, 50, 0, 68, 138, 139, 0, 121, 22, 26, 0, 106, 139, 66, 16, 106, 139, 139, 68, 121, 139, 3, 0, 1, 2, 190, 0, 119, 0, 64, 0, 94, 23, 3, 136, 2, 139, 0, 0, 192, 255, 255, 15, 50, 139, 139, 23, 72, 132, 0, 0, 1, 2, 193, 0, 119, 0, 57, 0, 25, 139, 23, 64, 135, 20, 93, 0, 139, 0, 0, 0, 106, 139, 66, 16, 109, 139, 68, 20, 120, 20, 3, 0, 1, 2, 193, 0, 119, 0, 49, 0, 94, 23, 3, 136, 135, 139, 52, 0, 20, 22, 23, 0, 106, 139, 66, 16, 109, 139, 72, 23, 135, 139, 60, 0, 68, 0, 0, 0, 1, 139, 255, 255, 54, 139, 139, 36, 160, 131, 0, 0, 1, 138, 0, 1, 3, 138, 3, 138, 33, 137, 1, 0, 15, 141, 30, 6, 19, 137, 137, 141, 121, 137, 5, 0, 41, 137, 30, 2, 3, 137, 1, 137, 0, 140, 137, 0, 119, 0, 3, 0, 1, 137, 0, 0, 0, 140, 137, 0, 135, 139, 103, 0, 0, 13, 138, 140, 1, 139, 72, 4, 94, 139, 0, 139, 38, 139, 139, 64, 121, 139, 5, 0, 1, 140, 0, 1, 3, 140, 3, 140, 135, 139, 60, 0, 140, 0, 0, 0, 1, 139, 224, 0, 1, 140, 224, 0, 94, 140, 13, 140, 25, 140, 140, 1, 97, 13, 139, 140, 25, 36, 24, 1, 1, 139, 160, 4, 3, 139, 0, 139, 135, 140, 89, 0, 139, 0, 0, 0, 121, 140, 4, 0, 0, 42, 36, 0, 1, 2, 65, 0, 119, 0, 144, 1, 0, 24, 36, 0, 119, 0, 204, 250, 32, 140, 2, 101, 121, 140, 11, 0, 1, 139, 48, 0, 2, 138, 0, 0, 159, 114, 11, 0, 1, 137, 200, 1, 3, 137, 3, 137, 135, 140, 5, 0, 0, 139, 138, 137, 0, 71, 24, 0, 0, 72, 24, 0, 119, 0, 130, 1, 32, 140, 2, 103, 121, 140, 69, 0, 1, 140, 208, 1, 97, 3, 140, 9, 1, 140, 208, 1, 3, 140, 3, 140, 109, 140, 4, 10, 1, 137, 48, 0, 2, 138, 0, 0, 175, 114, 11, 0, 1, 139, 208, 1, 3, 139, 3, 139, 135, 140, 5, 0, 0, 137, 138, 139, 106, 27, 0, 24, 120, 27, 5, 0, 0, 73, 24, 0, 0, 74, 24, 0, 1, 2, 239, 0, 119, 0, 110, 1, 1, 25, 0, 0, 0, 26, 27, 0, 106, 140, 0, 28, 41, 139, 25, 2, 94, 27, 140, 139, 1, 140, 164, 0, 94, 140, 27, 140, 120, 140, 33, 0, 1, 140, 180, 0, 94, 140, 27, 140, 106, 140, 140, 16, 34, 140, 140, 2, 121, 140, 26, 0, 94, 140, 27, 134, 82, 140, 140, 0, 120, 140, 21, 0, 106, 139, 0, 4, 82, 139, 139, 0, 2, 138, 0, 0, 222, 114, 11, 0, 135, 140, 19, 0, 139, 138, 0, 0, 120, 140, 3, 0, 0, 75, 26, 0, 119, 0, 17, 0, 1, 140, 216, 1, 97, 3, 140, 25, 1, 138, 24, 0, 2, 139, 0, 0, 229, 114, 11, 0, 1, 137, 216, 1, 3, 137, 3, 137, 135, 140, 5, 0, 0, 138, 139, 137, 106, 75, 0, 24, 119, 0, 6, 0, 0, 75, 26, 0, 119, 0, 4, 0, 0, 75, 26, 0, 119, 0, 2, 0, 0, 75, 26, 0, 25, 25, 25, 1, 50, 140, 75, 25, 104, 134, 0, 0, 0, 73, 24, 0, 0, 74, 24, 0, 1, 2, 239, 0, 119, 0, 62, 1, 0, 26, 75, 0, 119, 0, 209, 255, 1, 140, 149, 0, 45, 140, 2, 140, 24, 135, 0, 0, 1, 140, 0, 1, 3, 140, 3, 140, 106, 26, 140, 32, 1, 140, 32, 2, 97, 3, 140, 63, 1, 140, 32, 2, 3, 140, 3, 140, 109, 140, 4, 62, 1, 140, 32, 2, 3, 140, 3, 140, 25, 25, 140, 8, 85, 25, 61, 0, 109, 25, 4, 60, 1, 140, 32, 2, 3, 140, 3, 140, 109, 140, 16, 26, 1, 137, 40, 0, 2, 139, 0, 0, 217, 115, 11, 0, 1, 138, 32, 2, 3, 138, 3, 138, 135, 140, 5, 0, 0, 137, 139, 138, 1, 140, 72, 4, 94, 140, 0, 140, 38, 140, 140, 64, 120, 140, 5, 0, 0, 73, 24, 0, 0, 74, 46, 0, 1, 2, 239, 0, 119, 0, 26, 1, 1, 138, 0, 1, 3, 138, 3, 138, 135, 140, 60, 0, 138, 0, 0, 0, 0, 73, 24, 0, 0, 74, 46, 0, 1, 2, 239, 0, 119, 0, 18, 1, 1, 140, 178, 0, 45, 140, 2, 140, 76, 135, 0, 0, 25, 138, 66, 28, 135, 140, 104, 0, 138, 0, 0, 0, 25, 138, 66, 32, 135, 140, 105, 0, 138, 0, 0, 0, 0, 28, 67, 0, 0, 29, 24, 0, 1, 2, 226, 1, 119, 0, 87, 11, 1, 140, 184, 0, 45, 140, 2, 140, 112, 135, 0, 0, 135, 140, 60, 0, 68, 0, 0, 0, 0, 28, 69, 0, 0, 29, 24, 0, 1, 2, 226, 1, 119, 0, 78, 11, 1, 140, 190, 0, 45, 140, 2, 140, 216, 135, 0, 0, 1, 140, 64, 2, 2, 138, 0, 0, 23, 116, 11, 0, 97, 3, 140, 138, 1, 138, 64, 2, 3, 138, 3, 138, 2, 140, 0, 0, 169, 103, 11, 0, 109, 138, 4, 140, 1, 140, 64, 2, 3, 140, 3, 140, 1, 138, 220, 13, 109, 140, 8, 138, 1, 140, 0, 0, 1, 139, 0, 0, 2, 137, 0, 0, 102, 48, 13, 0, 1, 141, 64, 2, 3, 141, 3, 141, 135, 138, 5, 0, 140, 139, 137, 141, 135, 138, 62, 0, 119, 0, 220, 0, 1, 138, 193, 0, 45, 138, 2, 138, 244, 135, 0, 0, 135, 138, 60, 0, 68, 0, 0, 0, 1, 70, 244, 255, 119, 0, 213, 0, 1, 138, 202, 0, 45, 138, 2, 138, 68, 139, 0, 0, 106, 138, 0, 24, 120, 138, 5, 0, 0, 73, 24, 0, 0, 74, 41, 0, 1, 2, 239, 0, 119, 0, 210, 0, 1, 26, 0, 0, 106, 138, 0, 28, 41, 141, 26, 2, 94, 25, 138, 141, 1, 138, 184, 2, 94, 138, 25, 138, 106, 27, 138, 16, 1, 141, 0, 0, 135, 138, 88, 0, 25, 141, 0, 0, 120, 138, 126, 0, 94, 8, 25, 134, 106, 21, 8, 4, 32, 138, 21, 27, 121, 138, 7, 0, 2, 138, 0, 0, 134, 228, 11, 0, 135, 76, 84, 0, 138, 0, 0, 0, 1, 2, 220, 0, 119, 0, 68, 0, 106, 138, 25, 8, 106, 36, 138, 12, 120, 36, 31, 0, 82, 138, 8, 0, 1, 141, 0, 0, 1, 137, 4, 0, 138, 138, 141, 137, 156, 136, 0, 0, 176, 136, 0, 0, 152, 136, 0, 0, 196, 136, 0, 0, 119, 0, 16, 0, 1, 141, 20, 5, 94, 23, 0, 141, 121, 23, 13, 0, 0, 77, 23, 0, 119, 0, 18, 0, 1, 141, 24, 5, 94, 23, 0, 141, 121, 23, 8, 0, 0, 77, 23, 0, 119, 0, 13, 0, 1, 141, 28, 5, 94, 23, 0, 141, 121, 23, 3, 0, 0, 77, 23, 0, 119, 0, 8, 0, 135, 23, 85, 0, 21, 0, 0, 0, 120, 23, 2, 0, 119, 0, 85, 0, 0, 77, 23, 0, 119, 0, 2, 0, 0, 77, 36, 0, 106, 138, 77, 16, 2, 141, 0, 0, 0, 0, 2, 0, 19, 138, 138, 141, 120, 138, 3, 0, 0, 78, 77, 0, 119, 0, 27, 0, 1, 138, 0, 0, 135, 36, 86, 0, 138, 0, 0, 0, 120, 36, 3, 0, 0, 78, 77, 0, 119, 0, 21, 0, 0, 23, 36, 0, 106, 138, 23, 12, 45, 138, 138, 21, 96, 137, 0, 0, 135, 138, 87, 0, 23, 0, 0, 0, 121, 138, 8, 0, 106, 138, 23, 16, 2, 141, 0, 0, 0, 2, 2, 0, 19, 138, 138, 141, 120, 138, 3, 0, 0, 78, 23, 0, 119, 0, 7, 0, 135, 23, 86, 0, 23, 0, 0, 0, 120, 23, 241, 255, 0, 76, 77, 0, 1, 2, 220, 0, 119, 0, 1, 0, 1, 138, 220, 0, 45, 138, 2, 138, 148, 137, 0, 0, 1, 2, 0, 0, 120, 76, 2, 0, 119, 0, 43, 0, 0, 78, 76, 0, 106, 138, 27, 12, 120, 138, 40, 0, 1, 141, 0, 0, 97, 3, 136, 141, 1, 141, 4, 5, 94, 21, 0, 141, 121, 21, 7, 0, 3, 138, 3, 136, 2, 137, 0, 0, 199, 63, 12, 0, 1, 139, 0, 0, 135, 141, 4, 0, 138, 137, 21, 139, 33, 137, 1, 0, 15, 138, 26, 6, 19, 137, 137, 138, 121, 137, 5, 0, 41, 137, 26, 2, 3, 137, 1, 137, 0, 139, 137, 0, 119, 0, 3, 0, 3, 137, 3, 136, 0, 139, 137, 0, 135, 141, 8, 0, 27, 78, 139, 0, 34, 141, 141, 0, 121, 141, 12, 0, 1, 141, 80, 2, 2, 139, 0, 0, 102, 114, 11, 0, 97, 3, 141, 139, 1, 141, 24, 0, 2, 137, 0, 0, 74, 114, 11, 0, 1, 138, 80, 2, 3, 138, 3, 138, 135, 139, 5, 0, 0, 141, 137, 138, 3, 138, 3, 136, 135, 139, 79, 0, 138, 0, 0, 0, 1, 139, 12, 5, 94, 139, 0, 139, 106, 139, 139, 4, 121, 139, 55, 0, 94, 139, 25, 134, 106, 139, 139, 4, 32, 139, 139, 27, 121, 139, 51, 0, 1, 139, 180, 0, 94, 139, 25, 139, 121, 139, 48, 0, 1, 139, 184, 2, 94, 139, 25, 139, 106, 27, 139, 16, 1, 139, 140, 0, 94, 139, 27, 139, 120, 139, 3, 0, 1, 2, 233, 0, 119, 0, 26, 0, 135, 13, 106, 0, 27, 0, 0, 0, 1, 139, 184, 2, 94, 139, 25, 139, 106, 139, 139, 16, 1, 138, 140, 0, 94, 21, 139, 138, 52, 139, 13, 21, 32, 139, 0, 0, 34, 139, 21, 3, 121, 139, 3, 0, 1, 2, 233, 0, 119, 0, 13, 0, 1, 139, 224, 1, 94, 13, 25, 139, 32, 139, 21, 3, 121, 139, 5, 0, 1, 139, 17, 0, 54, 139, 139, 13, 32, 139, 0, 0, 119, 0, 5, 0, 1, 139, 19, 0, 54, 139, 139, 13, 32, 139, 0, 0, 119, 0, 1, 0, 1, 139, 233, 0, 45, 139, 2, 139, 12, 139, 0, 0, 1, 2, 0, 0, 1, 139, 6, 0, 1, 138, 224, 1, 94, 138, 25, 138, 54, 139, 139, 138, 32, 139, 0, 0, 1, 138, 12, 5, 94, 138, 0, 138, 106, 138, 138, 4, 135, 139, 107, 0, 0, 26, 138, 0, 25, 26, 26, 1, 106, 139, 0, 24, 50, 139, 139, 26, 64, 139, 0, 0, 0, 73, 24, 0, 0, 74, 41, 0, 1, 2, 239, 0, 119, 0, 8, 0, 119, 0, 55, 255, 0, 28, 70, 0, 0, 29, 24, 0, 1, 2, 226, 1, 119, 0, 85, 10, 1, 42, 0, 0, 1, 2, 65, 0, 32, 139, 2, 65, 121, 139, 12, 0, 1, 138, 48, 0, 2, 137, 0, 0, 128, 114, 11, 0, 1, 141, 192, 1, 3, 141, 3, 141, 135, 139, 5, 0, 0, 138, 137, 141, 0, 73, 42, 0, 2, 74, 0, 0, 187, 167, 182, 171, 1, 2, 239, 0, 1, 139, 239, 0, 45, 139, 2, 139, 64, 141, 0, 0, 34, 139, 10, 0, 32, 141, 10, 0, 35, 137, 9, 1, 19, 141, 141, 137, 20, 139, 139, 141, 121, 139, 4, 0, 0, 71, 73, 0, 0, 72, 74, 0, 119, 0, 97, 0, 3, 43, 3, 136, 25, 44, 43, 72, 1, 139, 0, 0, 85, 43, 139, 0, 25, 43, 43, 4, 54, 139, 43, 44, 200, 139, 0, 0, 3, 141, 3, 136, 135, 139, 63, 0, 141, 0, 0, 0, 106, 139, 0, 24, 121, 139, 83, 0, 120, 1, 38, 0, 1, 26, 0, 0, 106, 139, 0, 28, 41, 141, 26, 2, 94, 25, 139, 141, 1, 139, 180, 0, 94, 139, 25, 139, 106, 139, 139, 60, 32, 139, 139, 1, 121, 139, 24, 0, 3, 139, 3, 136, 1, 141, 0, 0, 135, 79, 103, 0, 0, 25, 139, 141, 36, 141, 79, 0, 120, 141, 6, 0, 1, 139, 0, 0, 135, 141, 88, 0, 25, 139, 0, 0, 121, 141, 247, 255, 119, 0, 13, 0, 34, 141, 79, 0, 121, 141, 11, 0, 1, 141, 96, 2, 82, 139, 25, 0, 97, 3, 141, 139, 1, 141, 32, 0, 2, 137, 0, 0, 46, 116, 11, 0, 1, 138, 96, 2, 3, 138, 3, 138, 135, 139, 5, 0, 0, 141, 137, 138, 25, 26, 26, 1, 106, 139, 0, 24, 55, 139, 26, 139, 248, 139, 0, 0, 119, 0, 45, 0, 1, 26, 0, 0, 106, 139, 0, 28, 41, 138, 26, 2, 94, 25, 139, 138, 1, 139, 180, 0, 94, 139, 25, 139, 106, 139, 139, 60, 32, 139, 139, 1, 121, 139, 32, 0, 47, 138, 26, 6, 196, 140, 0, 0, 41, 138, 26, 2, 3, 138, 1, 138, 0, 139, 138, 0, 119, 0, 3, 0, 1, 138, 0, 0, 0, 139, 138, 0, 0, 24, 139, 0, 3, 139, 3, 136, 135, 80, 103, 0, 0, 25, 139, 24, 36, 139, 80, 0, 120, 139, 6, 0, 1, 138, 0, 0, 135, 139, 88, 0, 25, 138, 0, 0, 121, 139, 248, 255, 119, 0, 13, 0, 34, 139, 80, 0, 121, 139, 11, 0, 1, 139, 88, 2, 82, 138, 25, 0, 97, 3, 139, 138, 1, 139, 32, 0, 2, 137, 0, 0, 46, 116, 11, 0, 1, 141, 88, 2, 3, 141, 3, 141, 135, 138, 5, 0, 0, 139, 137, 141, 25, 26, 26, 1, 106, 138, 0, 24, 55, 138, 26, 138, 140, 140, 0, 0, 0, 71, 73, 0, 0, 72, 74, 0, 135, 138, 108, 0, 0, 0, 0, 0, 106, 138, 0, 24, 121, 138, 221, 1, 1, 26, 0, 0, 106, 138, 0, 28, 41, 141, 26, 2, 94, 25, 138, 141, 1, 138, 184, 2, 94, 138, 25, 138, 106, 24, 138, 16, 106, 138, 24, 8, 1, 140, 0, 0, 1, 142, 2, 0, 138, 138, 140, 142, 136, 141, 0, 0, 24, 148, 0, 0, 119, 0, 202, 1, 106, 141, 24, 16, 32, 141, 141, 13, 121, 141, 16, 0, 106, 141, 24, 20, 120, 141, 14, 0, 1, 141, 160, 2, 94, 141, 24, 141, 120, 141, 11, 0, 106, 141, 24, 112, 135, 27, 109, 0, 141, 0, 0, 0, 135, 141, 110, 0, 135, 13, 111, 0, 141, 27, 0, 0, 106, 141, 24, 112, 45, 141, 13, 141, 208, 141, 0, 0, 109, 24, 20, 27, 1, 141, 180, 0, 94, 27, 25, 141, 106, 13, 27, 48, 25, 141, 27, 48, 106, 21, 141, 4, 32, 141, 13, 0, 32, 137, 21, 0, 19, 141, 141, 137, 120, 141, 36, 1, 106, 141, 25, 68, 120, 141, 34, 1, 106, 8, 27, 40, 25, 141, 27, 40, 106, 23, 141, 4, 32, 141, 8, 0, 32, 137, 23, 0, 19, 141, 141, 137, 120, 141, 27, 1, 1, 141, 248, 2, 94, 27, 24, 141, 1, 141, 248, 2, 3, 141, 24, 141, 106, 36, 141, 4, 106, 22, 25, 16, 1, 141, 255, 255, 2, 137, 0, 0, 255, 255, 255, 127, 34, 139, 22, 0, 41, 139, 139, 31, 42, 139, 139, 31, 135, 20, 91, 0, 141, 137, 22, 139, 135, 139, 2, 0, 1, 137, 2, 0, 1, 141, 0, 0, 135, 7, 91, 0, 20, 139, 137, 141, 135, 20, 2, 0, 15, 141, 23, 20, 13, 137, 23, 20, 16, 139, 8, 7, 19, 137, 137, 139, 20, 141, 141, 137, 120, 141, 2, 0, 119, 0, 139, 1, 106, 7, 25, 20, 1, 141, 255, 255, 2, 137, 0, 0, 255, 255, 255, 127, 34, 139, 7, 0, 41, 139, 139, 31, 42, 139, 139, 31, 135, 20, 91, 0, 141, 137, 7, 139, 135, 50, 2, 0, 34, 139, 23, 0, 15, 137, 50, 21, 13, 141, 21, 50, 18, 140, 20, 13, 19, 141, 141, 140, 20, 137, 137, 141, 20, 139, 139, 137, 120, 139, 121, 1, 34, 139, 7, 0, 41, 139, 139, 31, 42, 139, 139, 31, 135, 20, 90, 0, 13, 21, 7, 139, 135, 7, 2, 0, 1, 139, 1, 0, 135, 21, 49, 0, 8, 23, 139, 0, 135, 139, 2, 0, 34, 137, 22, 0, 41, 137, 137, 31, 42, 137, 137, 31, 135, 23, 90, 0, 21, 139, 22, 137, 25, 139, 25, 68, 25, 141, 25, 72, 135, 140, 2, 0, 2, 142, 0, 0, 96, 234, 0, 0, 1, 143, 0, 0, 135, 137, 112, 0, 139, 141, 20, 7, 23, 140, 142, 143, 106, 137, 25, 68, 76, 137, 137, 0, 106, 143, 25, 72, 76, 143, 143, 0, 66, 81, 137, 143, 1, 137, 0, 0, 47, 137, 137, 36, 128, 143, 0, 0, 1, 142, 0, 0, 47, 142, 142, 27, 112, 143, 0, 0, 1, 142, 12, 5, 94, 142, 0, 142, 106, 142, 142, 100, 33, 142, 142, 0, 0, 137, 142, 0, 119, 0, 3, 0, 1, 142, 0, 0, 0, 137, 142, 0, 0, 143, 137, 0, 119, 0, 3, 0, 1, 137, 0, 0, 0, 143, 137, 0, 121, 143, 95, 0, 62, 82, 0, 0, 123, 20, 174, 71, 225, 122, 132, 63, 1, 23, 0, 0, 1, 7, 0, 0, 1, 143, 104, 1, 48, 143, 7, 143, 192, 143, 0, 0, 1, 143, 233, 3, 5, 143, 7, 143, 1, 137, 233, 3, 3, 83, 143, 137, 119, 0, 48, 0, 1, 137, 134, 1, 48, 137, 7, 137, 228, 143, 0, 0, 1, 137, 236, 46, 5, 137, 7, 137, 2, 143, 0, 0, 76, 77, 60, 0, 4, 83, 137, 143, 119, 0, 39, 0, 1, 143, 137, 1, 48, 143, 7, 143, 48, 144, 0, 0, 1, 137, 80, 0, 97, 3, 136, 137, 3, 137, 3, 136, 1, 143, 120, 0, 109, 137, 4, 143, 3, 143, 3, 136, 1, 137, 240, 0, 109, 143, 8, 137, 3, 137, 3, 136, 1, 143, 134, 1, 4, 143, 7, 143, 41, 143, 143, 2, 94, 137, 137, 143, 1, 143, 236, 46, 5, 83, 137, 143, 119, 0, 20, 0, 1, 143, 24, 0, 85, 3, 143, 0, 1, 137, 30, 0, 109, 3, 4, 137, 1, 143, 60, 0, 109, 3, 8, 143, 1, 137, 12, 0, 109, 3, 12, 137, 1, 143, 15, 0, 109, 3, 16, 143, 1, 137, 48, 0, 109, 3, 20, 137, 1, 137, 137, 1, 4, 137, 7, 137, 41, 137, 137, 2, 94, 137, 3, 137, 1, 143, 224, 46, 5, 83, 137, 143, 119, 0, 1, 0, 76, 143, 83, 0, 59, 137, 236, 46, 66, 84, 143, 137, 66, 137, 81, 84, 59, 143, 255, 255, 63, 137, 137, 143, 135, 85, 53, 0, 137, 0, 0, 0, 71, 20, 85, 82, 126, 86, 20, 85, 82, 0, 0, 0, 76, 137, 27, 0, 76, 143, 36, 0, 66, 137, 137, 143, 66, 137, 137, 84, 59, 143, 255, 255, 63, 137, 137, 143, 135, 85, 53, 0, 137, 0, 0, 0, 71, 137, 85, 86, 20, 137, 137, 20, 125, 22, 137, 83, 23, 0, 0, 0, 25, 7, 7, 1, 1, 137, 143, 1, 45, 137, 7, 137, 240, 144, 0, 0, 0, 87, 22, 0, 119, 0, 87, 0, 71, 137, 85, 86, 126, 82, 137, 85, 86, 0, 0, 0, 0, 23, 22, 0, 119, 0, 168, 255, 62, 82, 0, 0, 123, 20, 174, 71, 225, 122, 132, 63, 1, 23, 0, 0, 1, 7, 0, 0, 1, 137, 104, 1, 48, 137, 7, 137, 56, 145, 0, 0, 1, 137, 233, 3, 5, 137, 7, 137, 1, 143, 233, 3, 3, 88, 137, 143, 119, 0, 48, 0, 1, 143, 134, 1, 48, 143, 7, 143, 92, 145, 0, 0, 1, 143, 236, 46, 5, 143, 7, 143, 2, 137, 0, 0, 76, 77, 60, 0, 4, 88, 143, 137, 119, 0, 39, 0, 1, 137, 137, 1, 48, 137, 7, 137, 168, 145, 0, 0, 1, 143, 80, 0, 97, 3, 136, 143, 3, 143, 3, 136, 1, 137, 120, 0, 109, 143, 4, 137, 3, 137, 3, 136, 1, 143, 240, 0, 109, 137, 8, 143, 3, 143, 3, 136, 1, 137, 134, 1, 4, 137, 7, 137, 41, 137, 137, 2, 94, 143, 143, 137, 1, 137, 236, 46, 5, 88, 143, 137, 119, 0, 20, 0, 1, 137, 24, 0, 85, 3, 137, 0, 1, 143, 30, 0, 109, 3, 4, 143, 1, 137, 60, 0, 109, 3, 8, 137, 1, 143, 12, 0, 109, 3, 12, 143, 1, 137, 15, 0, 109, 3, 16, 137, 1, 143, 48, 0, 109, 3, 20, 143, 1, 143, 137, 1, 4, 143, 7, 143, 41, 143, 143, 2, 94, 143, 3, 143, 1, 137, 224, 46, 5, 88, 143, 137, 119, 0, 1, 0, 76, 137, 88, 0, 59, 143, 236, 46, 66, 137, 137, 143, 66, 137, 81, 137, 59, 143, 255, 255, 63, 137, 137, 143, 135, 86, 53, 0, 137, 0, 0, 0, 71, 36, 86, 82, 125, 27, 36, 88, 23, 0, 0, 0, 25, 7, 7, 1, 1, 137, 143, 1, 45, 137, 7, 137, 56, 146, 0, 0, 0, 87, 27, 0, 119, 0, 5, 0, 126, 82, 36, 86, 82, 0, 0, 0, 0, 23, 27, 0, 119, 0, 181, 255, 121, 87, 14, 0, 25, 143, 25, 68, 25, 142, 25, 72, 34, 140, 87, 0, 41, 140, 140, 31, 42, 140, 140, 31, 1, 141, 236, 46, 1, 139, 0, 0, 2, 144, 0, 0, 255, 255, 255, 127, 1, 145, 0, 0, 135, 137, 112, 0, 143, 142, 87, 140, 141, 139, 144, 145, 1, 137, 164, 0, 94, 137, 25, 137, 120, 137, 59, 0, 106, 23, 24, 80, 106, 7, 25, 16, 34, 137, 7, 0, 41, 137, 137, 31, 42, 137, 137, 31, 34, 145, 23, 0, 41, 145, 145, 31, 42, 145, 145, 31, 135, 27, 90, 0, 7, 137, 23, 145, 135, 36, 2, 0, 106, 22, 24, 76, 106, 20, 24, 84, 5, 21, 20, 22, 106, 8, 25, 20, 34, 145, 21, 0, 41, 145, 145, 31, 42, 145, 145, 31, 34, 137, 8, 0, 41, 137, 137, 31, 42, 137, 137, 31, 135, 13, 90, 0, 21, 145, 8, 137, 135, 21, 2, 0, 15, 137, 21, 36, 13, 145, 36, 21, 16, 144, 13, 27, 19, 145, 145, 144, 20, 137, 137, 145, 121, 137, 6, 0, 1, 137, 164, 0, 97, 25, 137, 8, 1, 137, 168, 0, 97, 25, 137, 7, 119, 0, 24, 0, 34, 137, 20, 0, 41, 137, 137, 31, 42, 137, 137, 31, 34, 145, 22, 0, 41, 145, 145, 31, 42, 145, 145, 31, 135, 7, 90, 0, 20, 137, 22, 145, 1, 137, 164, 0, 3, 137, 25, 137, 1, 144, 168, 0, 3, 144, 25, 144, 34, 139, 23, 0, 41, 139, 139, 31, 42, 139, 139, 31, 135, 141, 2, 0, 2, 140, 0, 0, 255, 255, 255, 127, 1, 142, 0, 0, 135, 145, 112, 0, 137, 144, 23, 139, 7, 141, 140, 142, 119, 0, 1, 0, 1, 145, 176, 2, 94, 145, 25, 145, 121, 145, 76, 0, 1, 145, 180, 2, 94, 145, 25, 145, 121, 145, 73, 0, 1, 145, 64, 3, 106, 142, 24, 96, 97, 3, 145, 142, 1, 142, 64, 3, 3, 142, 3, 142, 25, 7, 142, 4, 25, 142, 24, 92, 116, 7, 142, 0, 1, 142, 176, 2, 3, 142, 25, 142, 116, 3, 142, 0, 1, 145, 176, 2, 3, 145, 25, 145, 106, 145, 145, 4, 109, 3, 4, 145, 1, 142, 64, 3, 94, 142, 3, 142, 97, 3, 136, 142, 3, 142, 3, 136, 82, 145, 7, 0, 109, 142, 4, 145, 1, 142, 56, 2, 3, 142, 3, 142, 3, 140, 3, 136, 135, 145, 113, 0, 142, 3, 140, 0, 1, 145, 56, 2, 3, 145, 3, 145, 106, 7, 145, 4, 1, 140, 56, 2, 94, 140, 3, 140, 109, 25, 56, 140, 25, 140, 25, 56, 109, 140, 4, 7, 119, 0, 38, 0, 1, 140, 160, 2, 94, 140, 24, 140, 120, 140, 6, 0, 106, 140, 24, 16, 135, 7, 114, 0, 140, 0, 0, 0, 1, 140, 160, 2, 97, 24, 140, 7, 1, 140, 136, 1, 94, 140, 24, 140, 1, 142, 1, 0, 1, 145, 8, 0, 138, 140, 142, 145, 112, 148, 0, 0, 124, 148, 0, 0, 136, 148, 0, 0, 108, 148, 0, 0, 148, 148, 0, 0, 108, 148, 0, 0, 108, 148, 0, 0, 160, 148, 0, 0, 119, 0, 16, 0, 1, 142, 0, 2, 109, 25, 48, 142, 119, 0, 13, 0, 1, 145, 0, 1, 109, 25, 48, 145, 119, 0, 10, 0, 1, 142, 128, 0, 109, 25, 48, 142, 119, 0, 7, 0, 1, 145, 8, 0, 109, 25, 48, 145, 119, 0, 4, 0, 1, 142, 32, 0, 109, 25, 48, 142, 119, 0, 1, 0, 25, 26, 26, 1, 106, 138, 0, 24, 57, 138, 138, 26, 192, 148, 0, 0, 119, 0, 38, 254, 32, 138, 9, 0, 32, 140, 10, 0, 19, 138, 138, 140, 120, 138, 190, 5, 106, 26, 0, 4, 106, 138, 26, 8, 38, 138, 138, 1, 120, 138, 21, 0, 106, 138, 0, 16, 135, 25, 115, 0, 138, 0, 0, 0, 135, 24, 2, 0, 106, 89, 0, 4, 1, 138, 0, 0, 15, 138, 138, 24, 32, 140, 24, 0, 1, 142, 0, 0, 16, 142, 142, 25, 19, 140, 140, 142, 20, 138, 138, 140, 0, 7, 138, 0, 1, 138, 0, 0, 125, 90, 7, 25, 138, 0, 0, 0, 1, 138, 0, 0, 125, 91, 7, 24, 138, 0, 0, 0, 119, 0, 4, 0, 0, 89, 26, 0, 1, 90, 0, 0, 1, 91, 0, 0, 82, 26, 89, 0, 2, 140, 0, 0, 49, 60, 12, 0, 135, 138, 19, 0, 26, 140, 0, 0, 120, 138, 9, 0, 32, 138, 90, 0, 32, 140, 91, 0, 19, 138, 138, 140, 121, 138, 3, 0, 1, 2, 135, 1, 119, 0, 16, 0, 1, 2, 59, 1, 119, 0, 14, 0, 33, 138, 90, 0, 33, 140, 91, 0, 20, 138, 138, 140, 2, 142, 0, 0, 238, 113, 11, 0, 135, 140, 19, 0, 26, 142, 0, 0, 32, 140, 140, 0, 19, 138, 138, 140, 121, 138, 3, 0, 1, 2, 59, 1, 119, 0, 2, 0, 1, 2, 135, 1, 1, 138, 59, 1, 45, 138, 2, 138, 16, 164, 0, 0, 106, 138, 0, 16, 106, 138, 138, 84, 38, 138, 138, 1, 120, 138, 3, 0, 1, 2, 135, 1, 119, 0, 146, 3, 1, 138, 12, 5, 94, 26, 0, 138, 121, 26, 61, 0, 106, 24, 26, 32, 121, 24, 12, 0, 0, 7, 24, 0, 97, 3, 136, 7, 0, 24, 7, 0, 106, 7, 7, 72, 135, 138, 60, 0, 24, 0, 0, 0, 3, 140, 3, 136, 135, 138, 73, 0, 140, 0, 0, 0, 33, 138, 7, 0, 120, 138, 247, 255, 1, 140, 0, 0, 109, 26, 32, 140, 1, 138, 0, 0, 109, 26, 36, 138, 1, 138, 12, 5, 94, 7, 0, 138, 106, 24, 7, 4, 121, 24, 12, 0, 0, 25, 24, 0, 97, 3, 136, 25, 0, 24, 25, 0, 106, 25, 25, 72, 135, 138, 60, 0, 24, 0, 0, 0, 3, 140, 3, 136, 135, 138, 73, 0, 140, 0, 0, 0, 33, 138, 25, 0, 120, 138, 247, 255, 1, 140, 0, 0, 109, 7, 4, 140, 1, 138, 0, 0, 109, 7, 8, 138, 1, 138, 12, 5, 94, 25, 0, 138, 106, 26, 25, 24, 121, 26, 12, 0, 0, 24, 26, 0, 97, 3, 136, 24, 0, 26, 24, 0, 106, 24, 24, 72, 135, 138, 60, 0, 26, 0, 0, 0, 3, 140, 3, 136, 135, 138, 73, 0, 140, 0, 0, 0, 33, 138, 24, 0, 120, 138, 247, 255, 1, 140, 0, 0, 109, 25, 24, 140, 1, 138, 0, 0, 109, 25, 28, 138, 1, 138, 12, 5, 94, 138, 0, 138, 2, 140, 0, 0, 160, 37, 38, 0, 109, 138, 40, 140, 106, 140, 0, 24, 121, 140, 56, 0, 1, 24, 0, 0, 106, 140, 0, 28, 41, 138, 24, 2, 94, 7, 140, 138, 106, 138, 7, 24, 32, 138, 138, 0, 121, 138, 8, 0, 25, 138, 7, 24, 106, 138, 138, 4, 2, 142, 0, 0, 0, 0, 0, 128, 13, 138, 138, 142, 0, 140, 138, 0, 119, 0, 3, 0, 1, 138, 0, 0, 0, 140, 138, 0, 121, 140, 27, 0, 94, 138, 7, 135, 32, 138, 138, 0, 121, 138, 8, 0, 3, 138, 7, 135, 106, 138, 138, 4, 2, 142, 0, 0, 0, 0, 0, 128, 13, 138, 138, 142, 0, 140, 138, 0, 119, 0, 3, 0, 1, 138, 0, 0, 0, 140, 138, 0, 121, 140, 14, 0, 94, 140, 7, 134, 82, 140, 140, 0, 33, 140, 140, 255, 121, 140, 10, 0, 1, 140, 104, 2, 97, 3, 140, 24, 1, 138, 24, 0, 2, 142, 0, 0, 77, 116, 11, 0, 1, 145, 104, 2, 3, 145, 3, 145, 135, 140, 5, 0, 0, 138, 142, 145, 1, 140, 232, 0, 94, 26, 7, 140, 121, 26, 6, 0, 135, 140, 116, 0, 26, 0, 0, 0, 1, 140, 232, 0, 1, 145, 0, 0, 97, 7, 140, 145, 25, 24, 24, 1, 106, 145, 0, 24, 55, 145, 24, 145, 212, 150, 0, 0, 1, 145, 88, 5, 94, 145, 0, 145, 120, 145, 252, 1, 2, 140, 0, 0, 203, 116, 11, 0, 2, 142, 0, 0, 65, 62, 13, 0, 1, 138, 1, 0, 135, 145, 81, 0, 0, 140, 142, 138, 106, 24, 0, 16, 120, 24, 4, 0, 1, 92, 0, 0, 1, 93, 0, 0, 119, 0, 5, 0, 135, 25, 115, 0, 24, 0, 0, 0, 0, 92, 25, 0, 135, 93, 2, 0, 1, 25, 0, 0, 1, 24, 0, 0, 2, 145, 0, 0, 144, 208, 3, 0, 1, 138, 0, 0, 135, 7, 49, 0, 145, 138, 25, 0, 135, 138, 2, 0, 135, 26, 20, 0, 92, 93, 7, 138, 135, 7, 2, 0, 1, 138, 0, 0, 15, 138, 138, 7, 32, 145, 7, 0, 1, 142, 0, 0, 16, 142, 142, 26, 19, 145, 145, 142, 20, 138, 138, 145, 0, 23, 138, 0, 106, 145, 0, 16, 1, 140, 0, 0, 125, 142, 23, 26, 140, 0, 0, 0, 1, 141, 0, 0, 125, 140, 23, 7, 141, 0, 0, 0, 1, 141, 0, 0, 135, 138, 33, 0, 145, 142, 140, 141, 135, 138, 2, 0, 26, 23, 25, 1, 2, 138, 0, 0, 144, 208, 3, 0, 1, 141, 0, 0, 1, 142, 0, 0, 15, 142, 142, 23, 1, 145, 0, 0, 125, 140, 142, 23, 145, 0, 0, 0, 135, 22, 49, 0, 138, 141, 140, 0, 135, 23, 2, 0, 1, 140, 0, 0, 15, 140, 140, 23, 32, 141, 23, 0, 1, 138, 0, 0, 16, 138, 138, 22, 19, 141, 141, 138, 20, 140, 140, 141, 121, 140, 51, 1, 1, 20, 0, 0, 0, 8, 24, 0, 1, 141, 72, 1, 3, 141, 3, 141, 134, 140, 0, 0, 172, 245, 0, 0, 0, 141, 0, 0, 1, 141, 245, 255, 1, 138, 12, 0, 138, 140, 141, 138, 32, 153, 0, 0, 24, 153, 0, 0, 24, 153, 0, 0, 24, 153, 0, 0, 24, 153, 0, 0, 24, 153, 0, 0, 24, 153, 0, 0, 24, 153, 0, 0, 24, 153, 0, 0, 24, 153, 0, 0, 24, 153, 0, 0, 36, 153, 0, 0, 0, 94, 8, 0, 119, 0, 28, 1, 119, 0, 234, 255, 119, 0, 1, 0, 1, 140, 72, 1, 3, 140, 3, 140, 106, 140, 140, 28, 3, 20, 140, 20, 106, 140, 0, 28, 1, 141, 72, 1, 3, 141, 3, 141, 106, 141, 141, 32, 41, 141, 141, 2, 94, 13, 140, 141, 1, 141, 72, 1, 3, 141, 3, 141, 106, 141, 141, 8, 32, 141, 141, 0, 121, 141, 10, 0, 1, 141, 72, 1, 3, 141, 3, 141, 25, 141, 141, 8, 106, 141, 141, 4, 2, 138, 0, 0, 0, 0, 0, 128, 13, 141, 141, 138, 0, 140, 141, 0, 119, 0, 3, 0, 1, 141, 0, 0, 0, 140, 141, 0, 121, 140, 3, 0, 0, 95, 8, 0, 119, 0, 234, 0, 106, 141, 13, 24, 32, 141, 141, 0, 121, 141, 8, 0, 25, 141, 13, 24, 106, 141, 141, 4, 2, 138, 0, 0, 0, 0, 0, 128, 13, 141, 141, 138, 0, 140, 141, 0, 119, 0, 3, 0, 1, 141, 0, 0, 0, 140, 141, 0, 121, 140, 16, 0, 94, 141, 13, 135, 32, 141, 141, 0, 121, 141, 8, 0, 3, 141, 13, 135, 106, 141, 141, 4, 2, 138, 0, 0, 0, 0, 0, 128, 13, 141, 141, 138, 0, 140, 141, 0, 119, 0, 3, 0, 1, 141, 0, 0, 0, 140, 141, 0, 121, 140, 3, 0, 0, 95, 8, 0, 119, 0, 206, 0, 1, 140, 72, 1, 3, 140, 3, 140, 25, 27, 140, 48, 82, 21, 27, 0, 106, 36, 27, 4, 32, 140, 21, 0, 32, 141, 36, 0, 19, 140, 140, 141, 121, 140, 61, 0, 1, 141, 52, 3, 3, 141, 3, 141, 1, 138, 48, 3, 3, 138, 3, 138, 1, 145, 232, 0, 94, 145, 13, 145, 1, 142, 72, 1, 3, 142, 3, 142, 135, 140, 117, 0, 0, 141, 138, 13, 145, 142, 0, 0, 1, 140, 48, 3, 94, 27, 3, 140, 1, 140, 52, 3, 94, 50, 3, 140, 33, 140, 27, 0, 33, 142, 50, 0, 19, 140, 140, 142, 121, 140, 36, 0, 106, 12, 13, 20, 34, 140, 12, 0, 41, 140, 140, 31, 42, 140, 140, 31, 34, 142, 50, 0, 41, 142, 142, 31, 42, 142, 142, 31, 135, 33, 90, 0, 12, 140, 50, 142, 135, 50, 2, 0, 106, 12, 13, 16, 34, 142, 12, 0, 41, 142, 142, 31, 42, 142, 142, 31, 34, 140, 27, 0, 41, 140, 140, 31, 42, 140, 140, 31, 135, 34, 90, 0, 12, 142, 27, 140, 1, 140, 1, 0, 1, 142, 0, 0, 135, 145, 2, 0, 1, 138, 2, 0, 135, 27, 118, 0, 140, 142, 33, 50, 34, 145, 138, 0, 135, 34, 2, 0, 1, 138, 72, 1, 3, 138, 3, 138, 25, 50, 138, 48, 85, 50, 27, 0, 109, 50, 4, 34, 0, 96, 27, 0, 0, 97, 34, 0, 119, 0, 9, 0, 1, 138, 72, 1, 3, 138, 3, 138, 25, 34, 138, 48, 82, 96, 34, 0, 106, 97, 34, 4, 119, 0, 3, 0, 0, 96, 21, 0, 0, 97, 36, 0, 1, 138, 72, 1, 3, 138, 3, 138, 25, 36, 138, 8, 82, 138, 36, 0, 106, 145, 36, 4, 135, 21, 44, 0, 138, 145, 96, 97, 135, 36, 2, 0, 106, 34, 13, 24, 25, 145, 13, 24, 106, 27, 145, 4, 32, 145, 34, 0, 2, 138, 0, 0, 0, 0, 0, 128, 13, 138, 27, 138, 19, 145, 145, 138, 121, 145, 5, 0, 94, 98, 13, 135, 3, 145, 13, 135, 106, 99, 145, 4, 119, 0, 3, 0, 0, 98, 34, 0, 0, 99, 27, 0, 135, 27, 20, 0, 21, 36, 98, 99, 135, 36, 2, 0, 1, 145, 0, 0, 15, 145, 145, 36, 32, 138, 36, 0, 1, 142, 0, 0, 16, 142, 142, 27, 19, 138, 138, 142, 20, 145, 145, 138, 120, 145, 3, 0, 1, 95, 1, 0, 119, 0, 99, 0, 106, 21, 13, 32, 25, 145, 13, 32, 106, 34, 145, 4, 1, 145, 180, 0, 94, 145, 13, 145, 25, 50, 145, 64, 32, 145, 21, 0, 2, 138, 0, 0, 0, 0, 0, 128, 13, 138, 34, 138, 19, 145, 145, 138, 121, 145, 3, 0, 1, 2, 103, 1, 119, 0, 75, 0, 82, 33, 50, 0, 106, 12, 50, 4, 34, 145, 12, 0, 32, 138, 12, 0, 35, 142, 33, 1, 19, 138, 138, 142, 20, 145, 145, 138, 121, 145, 3, 0, 1, 2, 103, 1, 119, 0, 65, 0, 15, 145, 34, 36, 13, 138, 34, 36, 16, 142, 21, 27, 19, 138, 138, 142, 20, 145, 145, 138, 120, 145, 2, 0, 119, 0, 58, 0, 135, 31, 20, 0, 27, 36, 33, 12, 135, 12, 2, 0, 1, 145, 0, 0, 1, 138, 0, 0, 135, 33, 20, 0, 145, 138, 31, 12, 135, 32, 2, 0, 1, 138, 255, 255, 15, 138, 138, 12, 32, 145, 12, 255, 1, 142, 255, 255, 16, 142, 142, 31, 19, 145, 145, 142, 20, 138, 138, 145, 125, 49, 138, 12, 32, 0, 0, 0, 106, 32, 13, 20, 34, 138, 32, 0, 41, 138, 138, 31, 42, 138, 138, 31, 1, 145, 60, 0, 1, 142, 0, 0, 135, 35, 90, 0, 32, 138, 145, 142, 135, 32, 2, 0, 106, 52, 13, 16, 34, 142, 52, 0, 41, 142, 142, 31, 42, 142, 142, 31, 135, 54, 91, 0, 35, 32, 52, 142, 135, 52, 2, 0, 47, 145, 49, 52, 204, 156, 0, 0, 1, 145, 1, 0, 0, 142, 145, 0, 119, 0, 18, 0, 45, 138, 49, 52, 4, 157, 0, 0, 1, 140, 255, 255, 15, 140, 140, 12, 32, 141, 12, 255, 1, 139, 255, 255, 16, 139, 139, 31, 19, 141, 141, 139, 20, 140, 140, 141, 125, 138, 140, 31, 33, 0, 0, 0, 16, 138, 138, 54, 0, 145, 138, 0, 119, 0, 3, 0, 1, 138, 0, 0, 0, 145, 138, 0, 0, 142, 145, 0, 121, 142, 2, 0, 1, 2, 103, 1, 1, 142, 103, 1, 45, 142, 2, 142, 52, 157, 0, 0, 1, 2, 0, 0, 109, 13, 32, 27, 25, 142, 13, 32, 109, 142, 4, 36, 85, 50, 27, 0, 109, 50, 4, 36, 1, 95, 1, 0, 1, 145, 72, 1, 3, 145, 3, 145, 135, 142, 60, 0, 145, 0, 0, 0, 34, 142, 20, 0, 41, 142, 142, 31, 42, 142, 142, 31, 0, 13, 142, 0, 15, 142, 13, 23, 13, 145, 23, 13, 16, 138, 20, 22, 19, 145, 145, 138, 20, 142, 142, 145, 120, 142, 3, 0, 0, 94, 95, 0, 119, 0, 4, 0, 0, 8, 95, 0, 119, 0, 209, 254, 0, 94, 24, 0, 120, 24, 52, 0, 106, 22, 0, 24, 120, 22, 2, 0, 119, 0, 49, 0, 106, 23, 0, 28, 1, 8, 1, 0, 1, 20, 0, 0, 41, 142, 20, 2, 94, 13, 23, 142, 94, 142, 13, 134, 82, 142, 142, 0, 35, 142, 142, 2, 121, 142, 17, 0, 106, 145, 13, 32, 32, 145, 145, 0, 121, 145, 8, 0, 25, 145, 13, 32, 106, 145, 145, 4, 2, 138, 0, 0, 0, 0, 0, 128, 13, 145, 145, 138, 0, 142, 145, 0, 119, 0, 3, 0, 1, 145, 0, 0, 0, 142, 145, 0, 1, 145, 0, 0, 125, 100, 142, 145, 8, 0, 0, 0, 119, 0, 2, 0, 0, 100, 8, 0, 25, 20, 20, 1, 52, 145, 20, 22, 24, 158, 0, 0, 0, 8, 100, 0, 119, 0, 229, 255, 1, 145, 0, 0, 15, 145, 145, 7, 32, 142, 7, 0, 1, 138, 0, 0, 16, 138, 138, 26, 19, 142, 142, 138, 20, 145, 145, 142, 32, 142, 100, 0, 19, 145, 145, 142, 120, 145, 2, 0, 119, 0, 7, 0, 25, 25, 25, 1, 1, 145, 7, 0, 57, 145, 145, 25, 92, 158, 0, 0, 0, 24, 94, 0, 119, 0, 106, 254, 2, 142, 0, 0, 203, 116, 11, 0, 2, 138, 0, 0, 8, 100, 13, 0, 1, 140, 1, 0, 135, 145, 81, 0, 0, 142, 138, 140, 106, 145, 0, 24, 121, 145, 81, 0, 1, 24, 0, 0, 106, 145, 0, 28, 41, 140, 24, 2, 94, 25, 145, 140, 106, 140, 25, 32, 32, 140, 140, 0, 121, 140, 8, 0, 25, 140, 25, 32, 106, 140, 140, 4, 2, 138, 0, 0, 0, 0, 0, 128, 13, 140, 140, 138, 0, 145, 140, 0, 119, 0, 3, 0, 1, 140, 0, 0, 0, 145, 140, 0, 121, 145, 52, 0, 1, 145, 2, 0, 94, 140, 25, 134, 82, 140, 140, 0, 57, 145, 145, 140, 144, 159, 0, 0, 106, 140, 25, 24, 32, 140, 140, 0, 121, 140, 8, 0, 25, 140, 25, 24, 106, 140, 140, 4, 2, 138, 0, 0, 0, 0, 0, 128, 13, 140, 140, 138, 0, 145, 140, 0, 119, 0, 3, 0, 1, 140, 0, 0, 0, 145, 140, 0, 121, 145, 25, 0, 94, 140, 25, 135, 32, 140, 140, 0, 121, 140, 8, 0, 3, 140, 25, 135, 106, 140, 140, 4, 2, 138, 0, 0, 0, 0, 0, 128, 13, 140, 140, 138, 0, 145, 140, 0, 119, 0, 3, 0, 1, 140, 0, 0, 0, 145, 140, 0, 120, 145, 2, 0, 119, 0, 11, 0, 1, 145, 128, 2, 97, 3, 145, 24, 1, 140, 48, 0, 2, 138, 0, 0, 19, 117, 11, 0, 1, 142, 128, 2, 3, 142, 3, 142, 135, 145, 5, 0, 0, 140, 138, 142, 119, 0, 10, 0, 1, 145, 120, 2, 97, 3, 145, 24, 1, 142, 48, 0, 2, 138, 0, 0, 216, 116, 11, 0, 1, 140, 120, 2, 3, 140, 3, 140, 135, 145, 5, 0, 0, 142, 138, 140, 25, 24, 24, 1, 106, 145, 0, 24, 55, 145, 24, 145, 132, 158, 0, 0, 119, 0, 8, 0, 1, 140, 32, 0, 2, 138, 0, 0, 143, 116, 11, 0, 1, 142, 112, 2, 3, 142, 3, 142, 135, 145, 5, 0, 0, 140, 138, 142, 135, 145, 119, 0, 0, 0, 0, 0, 106, 145, 0, 24, 121, 145, 98, 0, 1, 24, 0, 0, 106, 145, 0, 28, 41, 142, 24, 2, 94, 25, 145, 142, 106, 142, 25, 24, 32, 142, 142, 0, 121, 142, 8, 0, 25, 142, 25, 24, 106, 142, 142, 4, 2, 138, 0, 0, 0, 0, 0, 128, 13, 142, 142, 138], eb + 30720);
                HEAPU8.set([0, 145, 142, 0, 119, 0, 3, 0, 1, 142, 0, 0, 0, 145, 142, 0, 121, 145, 77, 0, 1, 145, 40, 4, 94, 26, 0, 145, 1, 145, 40, 4, 3, 145, 0, 145, 106, 7, 145, 4, 32, 145, 26, 0, 2, 142, 0, 0, 0, 0, 0, 128, 13, 142, 7, 142, 19, 145, 145, 142, 120, 145, 28, 0, 1, 145, 64, 3, 1, 142, 1, 0, 97, 3, 145, 142, 1, 142, 64, 3, 3, 142, 3, 142, 25, 8, 142, 4, 2, 142, 0, 0, 64, 66, 15, 0, 85, 8, 142, 0, 1, 142, 64, 3, 3, 142, 3, 142, 116, 3, 142, 0, 82, 145, 8, 0, 109, 3, 4, 145, 106, 142, 25, 16, 97, 3, 136, 142, 3, 142, 3, 136, 25, 145, 25, 16, 106, 145, 145, 4, 109, 142, 4, 145, 3, 145, 3, 136, 135, 8, 34, 0, 26, 7, 3, 145, 135, 7, 2, 0, 109, 25, 24, 8, 25, 145, 25, 24, 109, 145, 4, 7, 1, 145, 48, 4, 94, 7, 0, 145, 1, 145, 48, 4, 3, 145, 0, 145, 106, 8, 145, 4, 32, 145, 7, 0, 2, 142, 0, 0, 0, 0, 0, 128, 13, 142, 8, 142, 19, 145, 145, 142, 120, 145, 28, 0, 1, 145, 56, 3, 1, 142, 1, 0, 97, 3, 145, 142, 1, 142, 56, 3, 3, 142, 3, 142, 25, 26, 142, 4, 2, 142, 0, 0, 64, 66, 15, 0, 85, 26, 142, 0, 1, 142, 56, 3, 3, 142, 3, 142, 116, 3, 142, 0, 82, 145, 26, 0, 109, 3, 4, 145, 106, 142, 25, 16, 97, 3, 136, 142, 3, 142, 3, 136, 25, 145, 25, 16, 106, 145, 145, 4, 109, 142, 4, 145, 3, 145, 3, 136, 135, 26, 34, 0, 7, 8, 3, 145, 135, 8, 2, 0, 109, 25, 32, 26, 25, 145, 25, 32, 109, 145, 4, 8, 25, 24, 24, 1, 106, 145, 0, 24, 55, 145, 24, 145, 212, 159, 0, 0, 106, 142, 0, 16, 1, 138, 0, 0, 135, 145, 33, 0, 142, 4, 5, 138, 135, 145, 2, 0, 106, 24, 0, 24, 121, 24, 168, 0, 106, 25, 0, 28, 1, 8, 0, 0, 41, 145, 8, 2, 94, 26, 25, 145, 3, 145, 26, 135, 106, 7, 145, 4, 1, 145, 200, 0, 94, 138, 26, 135, 97, 26, 145, 138, 1, 138, 200, 0, 3, 138, 26, 138, 109, 138, 4, 7, 1, 138, 208, 0, 1, 145, 0, 0, 97, 26, 138, 145, 1, 145, 208, 0, 3, 145, 26, 145, 2, 138, 0, 0, 0, 0, 0, 128, 109, 145, 4, 138, 1, 138, 160, 2, 1, 145, 0, 0, 97, 26, 138, 145, 1, 145, 160, 2, 3, 145, 26, 145, 2, 138, 0, 0, 0, 0, 0, 128, 109, 145, 4, 138, 1, 138, 0, 1, 1, 145, 0, 0, 97, 26, 138, 145, 1, 145, 0, 1, 3, 145, 26, 145, 2, 138, 0, 0, 0, 0, 0, 128, 109, 145, 4, 138, 1, 138, 8, 1, 1, 145, 0, 0, 97, 26, 138, 145, 1, 145, 8, 1, 3, 145, 26, 145, 2, 138, 0, 0, 0, 0, 0, 128, 109, 145, 4, 138, 1, 138, 16, 1, 1, 145, 0, 0, 97, 26, 138, 145, 1, 145, 16, 1, 3, 145, 26, 145, 2, 138, 0, 0, 0, 0, 0, 128, 109, 145, 4, 138, 1, 138, 24, 1, 1, 145, 0, 0, 97, 26, 138, 145, 1, 145, 24, 1, 3, 145, 26, 145, 2, 138, 0, 0, 0, 0, 0, 128, 109, 145, 4, 138, 1, 138, 32, 1, 1, 145, 0, 0, 97, 26, 138, 145, 1, 145, 32, 1, 3, 145, 26, 145, 2, 138, 0, 0, 0, 0, 0, 128, 109, 145, 4, 138, 1, 138, 40, 1, 1, 145, 0, 0, 97, 26, 138, 145, 1, 145, 40, 1, 3, 145, 26, 145, 2, 138, 0, 0, 0, 0, 0, 128, 109, 145, 4, 138, 1, 138, 48, 1, 1, 145, 0, 0, 97, 26, 138, 145, 1, 145, 48, 1, 3, 145, 26, 145, 2, 138, 0, 0, 0, 0, 0, 128, 109, 145, 4, 138, 1, 138, 56, 1, 1, 145, 0, 0, 97, 26, 138, 145, 1, 145, 56, 1, 3, 145, 26, 145, 2, 138, 0, 0, 0, 0, 0, 128, 109, 145, 4, 138, 1, 138, 64, 1, 1, 145, 0, 0, 97, 26, 138, 145, 1, 145, 64, 1, 3, 145, 26, 145, 2, 138, 0, 0, 0, 0, 0, 128, 109, 145, 4, 138, 1, 138, 72, 1, 1, 145, 0, 0, 97, 26, 138, 145, 1, 145, 72, 1, 3, 145, 26, 145, 2, 138, 0, 0, 0, 0, 0, 128, 109, 145, 4, 138, 1, 138, 80, 1, 1, 145, 0, 0, 97, 26, 138, 145, 1, 145, 80, 1, 3, 145, 26, 145, 2, 138, 0, 0, 0, 0, 0, 128, 109, 145, 4, 138, 1, 138, 88, 1, 1, 145, 0, 0, 97, 26, 138, 145, 1, 145, 88, 1, 3, 145, 26, 145, 2, 138, 0, 0, 0, 0, 0, 128, 109, 145, 4, 138, 1, 138, 96, 1, 1, 145, 0, 0, 97, 26, 138, 145, 1, 145, 96, 1, 3, 145, 26, 145, 2, 138, 0, 0, 0, 0, 0, 128, 109, 145, 4, 138, 1, 138, 104, 1, 1, 145, 0, 0, 97, 26, 138, 145, 1, 145, 104, 1, 3, 145, 26, 145, 2, 138, 0, 0, 0, 0, 0, 128, 109, 145, 4, 138, 1, 138, 112, 1, 1, 145, 0, 0, 97, 26, 138, 145, 1, 145, 112, 1, 3, 145, 26, 145, 2, 138, 0, 0, 0, 0, 0, 128, 109, 145, 4, 138, 1, 138, 120, 1, 1, 145, 0, 0, 97, 26, 138, 145, 1, 145, 120, 1, 3, 145, 26, 145, 2, 138, 0, 0, 0, 0, 0, 128, 109, 145, 4, 138, 1, 138, 128, 1, 1, 145, 0, 0, 97, 26, 138, 145, 1, 145, 128, 1, 3, 145, 26, 145, 2, 138, 0, 0, 0, 0, 0, 128, 109, 145, 4, 138, 25, 8, 8, 1, 53, 138, 8, 24, 120, 161, 0, 0, 1, 101, 0, 0, 1, 138, 135, 1, 45, 138, 2, 138, 16, 170, 0, 0, 106, 24, 0, 24, 120, 24, 3, 0, 1, 2, 139, 1, 119, 0, 25, 0, 106, 8, 0, 28, 1, 25, 0, 0, 41, 138, 25, 2, 94, 138, 8, 138, 25, 26, 138, 32, 25, 25, 25, 1, 82, 145, 26, 0, 32, 145, 145, 0, 121, 145, 7, 0, 106, 145, 26, 4, 2, 142, 0, 0, 0, 0, 0, 128, 13, 145, 145, 142, 0, 138, 145, 0, 119, 0, 3, 0, 1, 145, 0, 0, 0, 138, 145, 0, 120, 138, 2, 0, 119, 0, 6, 0, 50, 138, 24, 25, 136, 164, 0, 0, 1, 2, 139, 1, 119, 0, 2, 0, 119, 0, 235, 255, 1, 138, 139, 1, 45, 138, 2, 138, 120, 168, 0, 0, 1, 145, 48, 4, 94, 145, 0, 145, 32, 145, 145, 0, 121, 145, 9, 0, 1, 145, 48, 4, 3, 145, 0, 145, 106, 145, 145, 4, 2, 142, 0, 0, 0, 0, 0, 128, 13, 145, 145, 142, 0, 138, 145, 0, 119, 0, 3, 0, 1, 145, 0, 0, 0, 138, 145, 0, 121, 138, 234, 0, 1, 138, 56, 4, 3, 138, 0, 138, 106, 25, 138, 4, 34, 145, 25, 0, 121, 145, 4, 0, 1, 145, 1, 0, 0, 138, 145, 0, 119, 0, 11, 0, 32, 142, 25, 0, 121, 142, 6, 0, 1, 142, 56, 4, 94, 142, 0, 142, 35, 142, 142, 1, 0, 145, 142, 0, 119, 0, 3, 0, 1, 142, 0, 0, 0, 145, 142, 0, 0, 138, 145, 0, 121, 138, 101, 0, 121, 24, 91, 0, 106, 8, 0, 28, 1, 26, 0, 0, 1, 7, 0, 0, 1, 22, 0, 0, 41, 138, 26, 2, 94, 20, 8, 138, 94, 23, 20, 134, 106, 13, 23, 24, 25, 138, 23, 24, 106, 21, 138, 4, 34, 138, 21, 0, 32, 145, 21, 0, 35, 142, 13, 1, 19, 145, 145, 142, 20, 138, 138, 145, 121, 138, 35, 0, 1, 138, 184, 2, 94, 138, 20, 138, 106, 138, 138, 16, 25, 34, 138, 40, 82, 54, 34, 0, 106, 33, 34, 4, 1, 138, 0, 0, 15, 138, 138, 33, 32, 145, 33, 0, 1, 142, 0, 0, 16, 142, 142, 54, 19, 145, 145, 142, 20, 138, 138, 145, 121, 138, 8, 0, 109, 23, 24, 54, 25, 138, 23, 24, 109, 138, 4, 33, 0, 102, 54, 0, 0, 103, 33, 0, 1, 2, 155, 1, 119, 0, 17, 0, 82, 138, 23, 0, 121, 138, 4, 0, 0, 104, 22, 0, 0, 105, 7, 0, 119, 0, 12, 0, 1, 138, 1, 0, 1, 145, 224, 0, 94, 145, 20, 145, 54, 138, 138, 145, 140, 166, 0, 0, 0, 104, 22, 0, 0, 105, 7, 0, 119, 0, 4, 0, 0, 102, 13, 0, 0, 103, 21, 0, 1, 2, 155, 1, 1, 138, 155, 1, 45, 138, 2, 138, 72, 166, 0, 0, 1, 2, 0, 0, 1, 138, 255, 255, 2, 145, 0, 0, 255, 255, 255, 127, 135, 21, 20, 0, 138, 145, 102, 103, 135, 13, 2, 0, 15, 145, 13, 7, 13, 138, 13, 7, 16, 142, 21, 22, 19, 138, 138, 142, 20, 145, 145, 138, 120, 145, 22, 0, 135, 21, 44, 0, 102, 103, 22, 7, 0, 104, 21, 0, 135, 105, 2, 0, 25, 26, 26, 1, 57, 145, 24, 26, 96, 166, 0, 0, 0, 7, 105, 0, 0, 22, 104, 0, 119, 0, 182, 255, 1, 145, 56, 4, 97, 0, 145, 104, 1, 145, 56, 4, 3, 145, 0, 145, 109, 145, 4, 105, 32, 145, 104, 0, 32, 138, 105, 0, 19, 145, 145, 138, 121, 145, 12, 0, 1, 101, 2, 0, 119, 0, 226, 0, 1, 145, 56, 4, 1, 138, 0, 0, 97, 0, 145, 138, 1, 138, 56, 4, 3, 138, 0, 138, 1, 145, 0, 0, 109, 138, 4, 145, 1, 101, 2, 0, 119, 0, 217, 0, 106, 24, 0, 16, 120, 24, 4, 0, 1, 106, 0, 0, 1, 107, 0, 0, 119, 0, 5, 0, 135, 25, 115, 0, 24, 0, 0, 0, 135, 106, 2, 0, 0, 107, 25, 0, 1, 145, 12, 5, 94, 145, 0, 145, 25, 25, 145, 16, 82, 24, 25, 0, 106, 22, 25, 4, 15, 145, 22, 106, 13, 138, 106, 22, 16, 142, 24, 107, 19, 138, 138, 142, 20, 145, 145, 138, 120, 145, 3, 0, 1, 101, 2, 0, 119, 0, 195, 0, 106, 25, 0, 24, 120, 25, 3, 0, 1, 101, 2, 0, 119, 0, 191, 0, 135, 7, 20, 0, 107, 106, 24, 22, 135, 22, 2, 0, 106, 24, 0, 28, 1, 145, 56, 4, 94, 26, 0, 145, 1, 145, 56, 4, 3, 145, 0, 145, 106, 8, 145, 4, 1, 145, 255, 255, 2, 138, 0, 0, 255, 255, 255, 127, 135, 21, 91, 0, 145, 138, 26, 8, 135, 13, 2, 0, 1, 138, 3, 0, 135, 20, 49, 0, 7, 22, 138, 0, 135, 22, 2, 0, 1, 7, 0, 0, 1, 23, 0, 0, 41, 138, 23, 2, 94, 36, 24, 138, 106, 50, 36, 16, 34, 138, 50, 0, 41, 138, 138, 31, 42, 138, 138, 31, 15, 138, 13, 138, 34, 145, 50, 0, 41, 145, 145, 31, 42, 145, 145, 31, 13, 145, 13, 145, 16, 142, 21, 50, 19, 145, 145, 142, 20, 138, 138, 145, 121, 138, 3, 0, 0, 108, 7, 0, 119, 0, 34, 0, 106, 145, 36, 32, 32, 145, 145, 0, 121, 145, 8, 0, 25, 145, 36, 32, 106, 145, 145, 4, 2, 142, 0, 0, 0, 0, 0, 128, 13, 145, 145, 142, 0, 138, 145, 0, 119, 0, 3, 0, 1, 145, 0, 0, 0, 138, 145, 0, 120, 138, 3, 0, 0, 108, 7, 0, 119, 0, 19, 0, 34, 138, 50, 0, 41, 138, 138, 31, 42, 138, 138, 31, 135, 27, 90, 0, 26, 8, 50, 138, 135, 33, 2, 0, 106, 54, 36, 20, 34, 138, 54, 0, 41, 138, 138, 31, 42, 138, 138, 31, 135, 34, 40, 0, 20, 22, 54, 138, 27, 33, 0, 0, 135, 33, 2, 0, 109, 36, 32, 34, 25, 138, 36, 32, 109, 138, 4, 33, 1, 108, 1, 0, 25, 23, 23, 1, 52, 138, 23, 25, 72, 168, 0, 0, 0, 7, 108, 0, 119, 0, 202, 255, 120, 108, 3, 0, 1, 101, 2, 0, 119, 0, 112, 0, 1, 145, 24, 0, 2, 142, 0, 0, 79, 117, 11, 0, 1, 140, 136, 2, 3, 140, 3, 140, 135, 138, 5, 0, 0, 145, 142, 140, 1, 101, 2, 0, 119, 0, 103, 0, 135, 138, 119, 0, 0, 0, 0, 0, 106, 138, 0, 24, 121, 138, 98, 0, 1, 7, 0, 0, 106, 138, 0, 28, 41, 140, 7, 2, 94, 25, 138, 140, 106, 140, 25, 24, 32, 140, 140, 0, 121, 140, 8, 0, 25, 140, 25, 24, 106, 140, 140, 4, 2, 142, 0, 0, 0, 0, 0, 128, 13, 140, 140, 142, 0, 138, 140, 0, 119, 0, 3, 0, 1, 140, 0, 0, 0, 138, 140, 0, 121, 138, 77, 0, 1, 138, 40, 4, 94, 23, 0, 138, 1, 138, 40, 4, 3, 138, 0, 138, 106, 22, 138, 4, 32, 138, 23, 0, 2, 140, 0, 0, 0, 0, 0, 128, 13, 140, 22, 140, 19, 138, 138, 140, 120, 138, 28, 0, 1, 138, 64, 3, 1, 140, 1, 0, 97, 3, 138, 140, 1, 140, 64, 3, 3, 140, 3, 140, 25, 20, 140, 4, 2, 140, 0, 0, 64, 66, 15, 0, 85, 20, 140, 0, 1, 140, 64, 3, 3, 140, 3, 140, 116, 3, 140, 0, 82, 138, 20, 0, 109, 3, 4, 138, 106, 140, 25, 16, 97, 3, 136, 140, 3, 140, 3, 136, 25, 138, 25, 16, 106, 138, 138, 4, 109, 140, 4, 138, 3, 138, 3, 136, 135, 20, 34, 0, 23, 22, 3, 138, 135, 22, 2, 0, 109, 25, 24, 20, 25, 138, 25, 24, 109, 138, 4, 22, 1, 138, 48, 4, 94, 22, 0, 138, 1, 138, 48, 4, 3, 138, 0, 138, 106, 20, 138, 4, 32, 138, 22, 0, 2, 140, 0, 0, 0, 0, 0, 128, 13, 140, 20, 140, 19, 138, 138, 140, 120, 138, 28, 0, 1, 138, 56, 3, 1, 140, 1, 0, 97, 3, 138, 140, 1, 140, 56, 3, 3, 140, 3, 140, 25, 23, 140, 4, 2, 140, 0, 0, 64, 66, 15, 0, 85, 23, 140, 0, 1, 140, 56, 3, 3, 140, 3, 140, 116, 3, 140, 0, 82, 138, 23, 0, 109, 3, 4, 138, 106, 140, 25, 16, 97, 3, 136, 140, 3, 140, 3, 136, 25, 138, 25, 16, 106, 138, 138, 4, 109, 140, 4, 138, 3, 138, 3, 136, 135, 23, 34, 0, 22, 20, 3, 138, 135, 20, 2, 0, 109, 25, 32, 23, 25, 138, 25, 32, 109, 138, 4, 20, 25, 7, 7, 1, 106, 138, 0, 24, 55, 138, 7, 138, 140, 168, 0, 0, 1, 101, 1, 0, 1, 138, 224, 4, 97, 0, 138, 101, 135, 138, 119, 0, 0, 0, 0, 0, 106, 138, 0, 24, 121, 138, 49, 0, 1, 7, 0, 0, 106, 138, 0, 28, 41, 140, 7, 2, 94, 20, 138, 140, 106, 138, 20, 16, 76, 138, 138, 0, 106, 140, 20, 20, 76, 140, 140, 0, 66, 82, 138, 140, 106, 140, 20, 24, 77, 140, 140, 0, 61, 138, 0, 0, 0, 0, 128, 79, 25, 142, 20, 24, 106, 142, 142, 4, 76, 142, 142, 0, 65, 138, 138, 142, 63, 140, 140, 138, 65, 81, 82, 140, 106, 140, 20, 32, 77, 140, 140, 0, 61, 138, 0, 0, 0, 0, 128, 79, 25, 142, 20, 32, 106, 142, 142, 4, 76, 142, 142, 0, 65, 138, 138, 142, 63, 140, 140, 138, 65, 86, 82, 140, 1, 140, 144, 2, 97, 3, 140, 7, 1, 140, 144, 2, 3, 140, 3, 140, 111, 140, 8, 81, 1, 140, 144, 2, 3, 140, 3, 140, 111, 140, 16, 86, 1, 138, 56, 0, 2, 142, 0, 0, 137, 117, 11, 0, 1, 145, 144, 2, 3, 145, 3, 145, 135, 140, 5, 0, 0, 138, 142, 145, 25, 7, 7, 1, 106, 140, 0, 24, 55, 140, 7, 140, 44, 170, 0, 0, 1, 140, 40, 4, 94, 140, 0, 140, 77, 140, 140, 0, 61, 145, 0, 0, 0, 0, 128, 79, 1, 142, 40, 4, 3, 142, 0, 142, 106, 142, 142, 4, 76, 142, 142, 0, 65, 145, 145, 142, 63, 140, 140, 145, 60, 145, 0, 0, 64, 66, 15, 0, 66, 86, 140, 145, 1, 145, 48, 4, 94, 145, 0, 145, 77, 145, 145, 0, 61, 140, 0, 0, 0, 0, 128, 79, 1, 142, 48, 4, 3, 142, 0, 142, 106, 142, 142, 4, 76, 142, 142, 0, 65, 140, 140, 142, 63, 145, 145, 140, 60, 140, 0, 0, 64, 66, 15, 0, 66, 81, 145, 140, 1, 140, 56, 4, 94, 140, 0, 140, 1, 145, 56, 4, 3, 145, 0, 145, 106, 145, 145, 4, 1, 142, 232, 3, 1, 138, 0, 0, 135, 7, 91, 0, 140, 145, 142, 138, 135, 20, 2, 0, 1, 138, 168, 2, 99, 3, 138, 86, 1, 138, 168, 2, 3, 138, 3, 138, 111, 138, 8, 81, 1, 138, 168, 2, 3, 138, 3, 138, 25, 25, 138, 16, 85, 25, 7, 0, 109, 25, 4, 20, 1, 142, 56, 0, 2, 145, 0, 0, 183, 117, 11, 0, 1, 140, 168, 2, 3, 140, 3, 140, 135, 138, 5, 0, 0, 142, 145, 140, 2, 140, 0, 0, 227, 113, 11, 0, 2, 145, 0, 0, 8, 100, 13, 0, 1, 142, 1, 0, 135, 138, 81, 0, 0, 140, 145, 142, 106, 20, 0, 24, 1, 142, 255, 255, 47, 142, 142, 72, 8, 172, 0, 0, 32, 145, 20, 0, 1, 140, 255, 255, 125, 142, 145, 72, 140, 0, 0, 0, 0, 138, 142, 0, 119, 0, 2, 0, 0, 138, 72, 0, 0, 25, 138, 0, 120, 20, 3, 0, 0, 109, 25, 0, 119, 0, 71, 0, 0, 7, 25, 0, 1, 23, 0, 0, 106, 138, 0, 28, 41, 142, 23, 2, 94, 22, 138, 142, 1, 138, 184, 2, 94, 8, 22, 138, 106, 138, 8, 20, 120, 138, 19, 0, 94, 26, 22, 134, 82, 138, 26, 0, 32, 138, 138, 1, 121, 138, 8, 0, 106, 138, 26, 20, 32, 138, 138, 255, 121, 138, 5, 0, 106, 142, 8, 16, 1, 140, 96, 1, 94, 142, 142, 140, 109, 26, 20, 142, 106, 142, 8, 16, 135, 110, 83, 0, 142, 26, 0, 0, 34, 142, 110, 0, 120, 142, 42, 0, 0, 111, 110, 0, 119, 0, 2, 0, 0, 111, 7, 0, 3, 138, 3, 136, 135, 142, 88, 0, 22, 138, 0, 0, 120, 142, 26, 0, 1, 138, 0, 1, 1, 140, 184, 2, 94, 140, 22, 140, 106, 140, 140, 16, 1, 145, 0, 0, 135, 142, 120, 0, 3, 138, 140, 145, 94, 22, 3, 136, 1, 142, 192, 2, 97, 3, 142, 23, 1, 142, 192, 2, 3, 142, 3, 142, 109, 142, 4, 3, 1, 142, 192, 2, 3, 142, 3, 142, 109, 142, 8, 22, 1, 145, 24, 0, 2, 140, 0, 0, 244, 117, 11, 0, 1, 138, 192, 2, 3, 138, 3, 138, 135, 142, 5, 0, 0, 145, 140, 138, 0, 112, 111, 0, 119, 0, 2, 0, 1, 112, 0, 0, 25, 23, 23, 1, 106, 142, 0, 24, 50, 142, 142, 23, 28, 173, 0, 0, 0, 109, 112, 0, 119, 0, 7, 0, 0, 7, 112, 0, 119, 0, 193, 255, 0, 28, 110, 0, 0, 29, 71, 0, 1, 2, 226, 1, 119, 0, 221, 1, 1, 142, 48, 4, 94, 25, 0, 142, 1, 142, 48, 4, 3, 142, 0, 142, 106, 20, 142, 4, 1, 142, 0, 0, 15, 142, 142, 20, 32, 138, 20, 0, 1, 140, 0, 0, 16, 140, 140, 25, 19, 138, 138, 140, 20, 142, 142, 138, 121, 142, 40, 0, 1, 142, 40, 4, 94, 7, 0, 142, 1, 142, 40, 4, 3, 142, 0, 142, 106, 23, 142, 4, 1, 142, 255, 255, 2, 138, 0, 0, 255, 255, 255, 127, 135, 22, 20, 0, 142, 138, 25, 20, 135, 26, 2, 0, 32, 138, 7, 0, 2, 142, 0, 0, 0, 0, 0, 128, 13, 142, 23, 142, 19, 138, 138, 142, 0, 8, 138, 0, 1, 142, 0, 0, 125, 138, 8, 142, 7, 0, 0, 0, 1, 140, 0, 0, 125, 142, 8, 140, 23, 0, 0, 0, 135, 21, 44, 0, 138, 142, 25, 20, 135, 20, 2, 0, 15, 142, 23, 26, 13, 138, 23, 26, 16, 140, 7, 22, 19, 138, 138, 140, 20, 142, 142, 138, 0, 25, 142, 0, 1, 142, 0, 0, 125, 113, 25, 21, 142, 0, 0, 0, 1, 142, 0, 0, 125, 114, 25, 20, 142, 0, 0, 0, 119, 0, 3, 0, 1, 113, 0, 0, 1, 114, 0, 0, 1, 142, 132, 4, 94, 20, 0, 142, 121, 20, 15, 1, 32, 142, 113, 0, 32, 138, 114, 0, 19, 142, 142, 138, 121, 142, 118, 0, 1, 25, 0, 0, 0, 21, 20, 0, 1, 142, 136, 4, 94, 22, 0, 142, 41, 142, 25, 2, 94, 7, 22, 142, 106, 138, 7, 24, 32, 138, 138, 0, 121, 138, 8, 0, 25, 138, 7, 24, 106, 138, 138, 4, 2, 140, 0, 0, 0, 0, 0, 128, 13, 138, 138, 140, 0, 142, 138, 0, 119, 0, 3, 0, 1, 138, 0, 0, 0, 142, 138, 0, 121, 142, 93, 0, 1, 26, 0, 0, 0, 23, 22, 0, 2, 22, 0, 0, 255, 255, 255, 127, 1, 8, 255, 255, 41, 142, 26, 2, 94, 13, 23, 142, 106, 24, 13, 16, 25, 142, 13, 16, 106, 36, 142, 4, 25, 142, 13, 4, 116, 3, 142, 0, 25, 138, 13, 4, 106, 138, 138, 4, 109, 3, 4, 138, 106, 142, 7, 4, 97, 3, 136, 142, 3, 142, 3, 136, 25, 138, 7, 4, 106, 138, 138, 4, 109, 142, 4, 138, 3, 138, 3, 136, 135, 13, 34, 0, 24, 36, 3, 138, 135, 36, 2, 0, 45, 138, 26, 25, 236, 174, 0, 0, 0, 115, 8, 0, 0, 116, 22, 0, 119, 0, 28, 0, 25, 138, 7, 16, 106, 24, 138, 4, 15, 138, 36, 22, 13, 142, 36, 22, 16, 140, 13, 8, 19, 142, 142, 140, 20, 138, 138, 142, 47, 140, 24, 36, 28, 175, 0, 0, 1, 140, 1, 0, 0, 142, 140, 0, 119, 0, 10, 0, 45, 145, 36, 24, 52, 175, 0, 0, 106, 145, 7, 16, 16, 145, 145, 13, 0, 140, 145, 0, 119, 0, 3, 0, 1, 145, 0, 0, 0, 140, 145, 0, 0, 142, 140, 0, 19, 138, 138, 142, 0, 50, 138, 0, 125, 115, 50, 13, 8, 0, 0, 0, 125, 116, 50, 36, 22, 0, 0, 0, 25, 36, 26, 1, 1, 138, 132, 4, 94, 117, 0, 138, 57, 138, 117, 36, 132, 175, 0, 0, 0, 26, 36, 0, 1, 138, 136, 4, 94, 23, 0, 138, 0, 22, 116, 0, 0, 8, 115, 0, 119, 0, 194, 255, 106, 8, 7, 16, 25, 138, 7, 16, 106, 22, 138, 4, 32, 138, 115, 255, 2, 142, 0, 0, 255, 255, 255, 127, 13, 142, 116, 142, 19, 138, 138, 142, 15, 142, 116, 22, 13, 140, 116, 22, 16, 145, 115, 8, 19, 140, 140, 145, 20, 142, 142, 140, 20, 138, 138, 142, 0, 23, 138, 0, 125, 142, 23, 8, 115, 0, 0, 0, 109, 7, 24, 142, 25, 142, 7, 24, 125, 138, 23, 22, 116, 0, 0, 0, 109, 142, 4, 138, 0, 118, 117, 0, 119, 0, 2, 0, 0, 118, 21, 0, 25, 25, 25, 1, 57, 138, 118, 25, 80, 178, 0, 0, 0, 21, 118, 0, 119, 0, 142, 255, 1, 21, 0, 0, 0, 25, 20, 0, 1, 138, 136, 4, 94, 138, 0, 138, 41, 142, 21, 2, 94, 22, 138, 142, 106, 142, 22, 24, 32, 142, 142, 0, 121, 142, 8, 0, 25, 142, 22, 24, 106, 142, 142, 4, 2, 140, 0, 0, 0, 0, 0, 128, 13, 142, 142, 140, 0, 138, 142, 0, 119, 0, 3, 0, 1, 142, 0, 0, 0, 138, 142, 0, 121, 138, 125, 0, 1, 138, 64, 3, 1, 142, 1, 0, 97, 3, 138, 142, 1, 142, 64, 3, 3, 142, 3, 142, 25, 23, 142, 4, 2, 142, 0, 0, 64, 66, 15, 0, 85, 23, 142, 0, 1, 142, 64, 3, 3, 142, 3, 142, 116, 3, 142, 0, 82, 138, 23, 0, 109, 3, 4, 138, 106, 142, 22, 4, 97, 3, 136, 142, 3, 142, 3, 136, 25, 138, 22, 4, 106, 138, 138, 4, 109, 142, 4, 138, 3, 138, 3, 136, 135, 23, 34, 0, 113, 114, 3, 138, 135, 8, 2, 0, 1, 138, 132, 4, 94, 138, 0, 138, 120, 138, 5, 0, 0, 119, 23, 0, 0, 120, 8, 0, 1, 121, 0, 0, 119, 0, 70, 0, 1, 26, 0, 0, 0, 36, 8, 0, 0, 8, 23, 0, 1, 138, 136, 4, 94, 138, 0, 138, 41, 142, 26, 2, 94, 23, 138, 142, 106, 50, 23, 16, 25, 138, 23, 16, 106, 13, 138, 4, 25, 138, 23, 4, 116, 3, 138, 0, 25, 142, 23, 4, 106, 142, 142, 4, 109, 3, 4, 142, 106, 138, 22, 4, 97, 3, 136, 138, 3, 138, 3, 136, 25, 142, 22, 4, 106, 142, 142, 4, 109, 138, 4, 142, 3, 142, 3, 136, 135, 23, 34, 0, 50, 13, 3, 142, 135, 13, 2, 0, 45, 142, 26, 21, 60, 177, 0, 0, 0, 122, 8, 0, 0, 123, 36, 0, 119, 0, 28, 0, 25, 142, 22, 16, 106, 50, 142, 4, 15, 142, 13, 36, 13, 138, 13, 36, 16, 140, 23, 8, 19, 138, 138, 140, 20, 142, 142, 138, 47, 140, 50, 13, 108, 177, 0, 0, 1, 140, 1, 0, 0, 138, 140, 0, 119, 0, 10, 0, 45, 145, 13, 50, 132, 177, 0, 0, 106, 145, 22, 16, 16, 145, 145, 23, 0, 140, 145, 0, 119, 0, 3, 0, 1, 145, 0, 0, 0, 140, 145, 0, 0, 138, 140, 0, 19, 142, 142, 138, 0, 24, 142, 0, 125, 122, 24, 23, 8, 0, 0, 0, 125, 123, 24, 13, 36, 0, 0, 0, 25, 26, 26, 1, 1, 142, 132, 4, 94, 13, 0, 142, 50, 142, 13, 26, 204, 177, 0, 0, 0, 119, 122, 0, 0, 120, 123, 0, 0, 121, 13, 0, 119, 0, 4, 0, 0, 36, 123, 0, 0, 8, 122, 0, 119, 0, 191, 255, 106, 8, 22, 16, 25, 142, 22, 16, 106, 36, 142, 4, 32, 142, 119, 255, 2, 138, 0, 0, 255, 255, 255, 127, 13, 138, 120, 138, 19, 142, 142, 138, 15, 138, 120, 36, 13, 140, 120, 36, 16, 145, 119, 8, 19, 140, 140, 145, 20, 138, 138, 140, 20, 142, 142, 138, 0, 26, 142, 0, 125, 138, 26, 8, 119, 0, 0, 0, 109, 22, 24, 138, 25, 138, 22, 24, 125, 142, 26, 36, 120, 0, 0, 0, 109, 138, 4, 142, 0, 124, 121, 0, 119, 0, 2, 0, 0, 124, 25, 0, 25, 21, 21, 1, 57, 142, 124, 21, 80, 178, 0, 0, 0, 25, 124, 0, 119, 0, 110, 255, 106, 142, 0, 24, 120, 142, 4, 0, 0, 125, 109, 0, 0, 126, 71, 0, 119, 0, 145, 0, 1, 25, 0, 0, 106, 142, 0, 28, 41, 138, 25, 2, 94, 21, 142, 138, 1, 142, 184, 2, 94, 20, 21, 142, 106, 142, 20, 20, 121, 142, 28, 0, 94, 36, 21, 134, 106, 26, 36, 48, 106, 8, 36, 52, 106, 142, 20, 16, 135, 7, 121, 0, 36, 142, 0, 0, 34, 142, 7, 0, 121, 142, 5, 0, 0, 28, 7, 0, 0, 29, 71, 0, 1, 2, 226, 1, 119, 0, 125, 0, 121, 26, 9, 0, 1, 138, 184, 2, 94, 138, 21, 138, 106, 138, 138, 16, 1, 140, 168, 2, 94, 138, 138, 140, 33, 138, 138, 0, 0, 142, 138, 0, 119, 0, 3, 0, 1, 138, 0, 0, 0, 142, 138, 0, 121, 142, 4, 0, 94, 7, 21, 134, 109, 7, 48, 26, 109, 7, 52, 8, 106, 142, 21, 8, 94, 138, 21, 134, 135, 8, 83, 0, 142, 138, 0, 0, 34, 138, 8, 0, 121, 138, 5, 0, 0, 28, 8, 0, 0, 29, 71, 0, 1, 2, 226, 1, 119, 0, 100, 0, 1, 138, 184, 2, 94, 138, 21, 138, 106, 7, 138, 16, 1, 138, 168, 2, 94, 26, 7, 138, 121, 26, 9, 0, 106, 20, 7, 92, 121, 20, 7, 0, 106, 36, 21, 8, 1, 138, 168, 2, 97, 36, 138, 26, 109, 36, 92, 20, 106, 142, 7, 96, 109, 36, 96, 142, 106, 36, 21, 8, 106, 142, 36, 20, 2, 138, 0, 0, 116, 109, 99, 100, 45, 142, 142, 138, 112, 179, 0, 0, 0, 127, 36, 0, 119, 0, 14, 0, 25, 142, 7, 76, 106, 20, 142, 4, 106, 138, 7, 76, 109, 36, 76, 138, 25, 138, 36, 76, 109, 138, 4, 20, 106, 20, 21, 8, 1, 142, 184, 2, 94, 142, 21, 142, 106, 142, 142, 16, 106, 142, 142, 84, 109, 20, 84, 142, 0, 127, 20, 0, 25, 142, 21, 68, 106, 20, 142, 4, 1, 142, 248, 2, 3, 36, 127, 142, 25, 142, 21, 68, 116, 36, 142, 0, 109, 36, 4, 20, 1, 142, 184, 2, 94, 20, 21, 142, 106, 36, 20, 16, 1, 142, 224, 2, 94, 142, 36, 142, 120, 142, 4, 0, 0, 128, 36, 0, 0, 129, 20, 0, 119, 0, 28, 0, 1, 142, 228, 2, 94, 142, 36, 142, 135, 20, 122, 0, 142, 0, 0, 0, 106, 36, 21, 8, 1, 142, 224, 2, 97, 36, 142, 20, 120, 20, 5, 0, 0, 28, 8, 0, 0, 29, 71, 0, 1, 2, 226, 1, 119, 0, 37, 0, 1, 142, 184, 2, 94, 142, 21, 142, 106, 7, 142, 16, 1, 142, 228, 2, 94, 26, 7, 142, 1, 142, 228, 2, 97, 36, 142, 26, 1, 138, 224, 2, 94, 138, 7, 138, 135, 142, 52, 0, 20, 138, 26, 0, 1, 142, 184, 2, 94, 26, 21, 142, 106, 128, 26, 16, 0, 129, 26, 0, 106, 26, 21, 8, 106, 138, 128, 100, 109, 26, 100, 138, 106, 142, 128, 104, 109, 26, 104, 142, 1, 142, 80, 3, 1, 138, 80, 3, 94, 138, 128, 138, 97, 26, 142, 138, 1, 142, 0, 0, 109, 129, 20, 142, 25, 25, 25, 1, 106, 26, 0, 24, 50, 142, 26, 25, 160, 180, 0, 0, 0, 130, 8, 0, 0, 131, 71, 0, 0, 132, 26, 0, 1, 2, 227, 1, 119, 0, 2, 0, 119, 0, 114, 255, 1, 142, 226, 1, 45, 142, 2, 142, 192, 180, 0, 0, 0, 130, 28, 0, 0, 131, 29, 0, 106, 132, 0, 24, 1, 2, 227, 1, 1, 142, 227, 1, 45, 142, 2, 142, 160, 181, 0, 0, 120, 132, 4, 0, 0, 125, 130, 0, 0, 126, 131, 0, 119, 0, 50, 0, 1, 132, 0, 0, 106, 142, 0, 28, 41, 138, 132, 2, 94, 2, 142, 138, 1, 142, 180, 0, 94, 29, 2, 142, 120, 29, 3, 0, 0, 133, 2, 0, 119, 0, 7, 0, 25, 138, 29, 32, 135, 142, 73, 0, 138, 0, 0, 0, 106, 142, 0, 28, 41, 138, 132, 2, 94, 133, 142, 138, 1, 138, 184, 2, 94, 138, 133, 138, 106, 138, 138, 16, 135, 142, 14, 0, 138, 0, 0, 0, 106, 138, 0, 28, 41, 140, 132, 2, 94, 138, 138, 140, 1, 140, 180, 0, 3, 138, 138, 140, 135, 142, 73, 0, 138, 0, 0, 0, 106, 138, 0, 28, 41, 140, 132, 2, 94, 138, 138, 140, 1, 140, 184, 2, 94, 138, 138, 140, 25, 138, 138, 28, 135, 142, 104, 0, 138, 0, 0, 0, 106, 138, 0, 28, 41, 140, 132, 2, 94, 138, 138, 140, 1, 140, 184, 2, 94, 138, 138, 140, 25, 138, 138, 32, 135, 142, 105, 0, 138, 0, 0, 0, 25, 132, 132, 1, 106, 142, 0, 24, 55, 142, 132, 142, 224, 180, 0, 0, 0, 125, 130, 0, 0, 126, 131, 0, 106, 131, 0, 16, 120, 131, 3, 0, 137, 3, 0, 0, 139, 125, 0, 0, 1, 142, 0, 0, 1, 138, 0, 0, 1, 140, 1, 0, 135, 130, 33, 0, 131, 142, 138, 140, 135, 131, 2, 0, 106, 132, 0, 16, 106, 133, 132, 104, 25, 140, 132, 104, 106, 29, 140, 4, 106, 2, 132, 112, 1, 140, 208, 2, 97, 3, 140, 130, 1, 140, 208, 2, 3, 140, 3, 140, 109, 140, 4, 131, 1, 140, 208, 2, 3, 140, 3, 140, 25, 131, 140, 8, 85, 131, 133, 0, 109, 131, 4, 29, 1, 140, 208, 2, 3, 140, 3, 140, 109, 140, 16, 2, 1, 140, 208, 2, 3, 140, 3, 140, 109, 140, 20, 126, 1, 138, 48, 0, 2, 142, 0, 0, 124, 118, 11, 0, 1, 145, 208, 2, 3, 145, 3, 145, 135, 140, 5, 0, 0, 138, 142, 145, 137, 3, 0, 0, 139, 125, 0, 0, 140, 2, 81, 0, 0, 0, 0, 0, 2, 67, 0, 0, 128, 0, 0, 0, 2, 68, 0, 0, 136, 0, 0, 0, 2, 69, 0, 0, 140, 0, 0, 0, 2, 70, 0, 0, 132, 0, 0, 0, 2, 71, 0, 0, 232, 0, 0, 0, 2, 72, 0, 0, 212, 0, 0, 0, 2, 73, 0, 0, 195, 0, 0, 0, 1, 2, 0, 0, 136, 74, 0, 0, 0, 3, 74, 0, 136, 74, 0, 0, 1, 75, 0, 1, 3, 74, 74, 75, 137, 74, 0, 0, 1, 74, 228, 0, 1, 75, 0, 0, 97, 3, 74, 75, 1, 75, 200, 0, 94, 4, 0, 75, 1, 75, 200, 0, 3, 75, 0, 75, 106, 5, 75, 4, 32, 75, 4, 255, 2, 74, 0, 0, 255, 255, 255, 127, 13, 74, 5, 74, 19, 75, 75, 74, 120, 75, 101, 0, 1, 74, 192, 0, 94, 74, 0, 74, 32, 74, 74, 255, 121, 74, 9, 0, 1, 74, 192, 0, 3, 74, 0, 74, 106, 74, 74, 4, 2, 76, 0, 0, 255, 255, 255, 127, 13, 74, 74, 76, 0, 75, 74, 0, 119, 0, 3, 0, 1, 74, 0, 0, 0, 75, 74, 0, 121, 75, 4, 0, 0, 6, 5, 0, 0, 7, 4, 0, 119, 0, 43, 0, 1, 75, 200, 0, 1, 74, 255, 255, 97, 0, 75, 74, 1, 74, 200, 0, 3, 74, 0, 74, 25, 8, 74, 4, 2, 74, 0, 0, 255, 255, 255, 127, 85, 8, 74, 0, 1, 75, 0, 0, 1, 76, 24, 0, 2, 77, 0, 0, 226, 18, 10, 0, 135, 74, 5, 0, 75, 76, 77, 3, 1, 74, 200, 0, 94, 9, 0, 74, 82, 10, 8, 0, 32, 74, 9, 255, 2, 77, 0, 0, 255, 255, 255, 127, 13, 77, 10, 77, 19, 74, 74, 77, 120, 74, 59, 0, 1, 77, 192, 0, 94, 77, 0, 77, 32, 77, 77, 255, 121, 77, 9, 0, 1, 77, 192, 0, 3, 77, 0, 77, 106, 77, 77, 4, 2, 76, 0, 0, 255, 255, 255, 127, 13, 77, 77, 76, 0, 74, 77, 0, 119, 0, 3, 0, 1, 77, 0, 0, 0, 74, 77, 0, 121, 74, 44, 0, 0, 6, 10, 0, 0, 7, 9, 0, 119, 0, 1, 0, 106, 9, 0, 8, 25, 74, 0, 8, 106, 10, 74, 4, 32, 74, 9, 0, 2, 77, 0, 0, 0, 0, 0, 128, 13, 77, 10, 77, 19, 74, 74, 77, 0, 8, 74, 0, 1, 74, 0, 0, 125, 11, 8, 74, 9, 0, 0, 0, 1, 74, 0, 0, 125, 9, 8, 74, 10, 0, 0, 0, 15, 74, 9, 6, 13, 77, 6, 9, 16, 76, 11, 7, 19, 77, 77, 76, 20, 74, 74, 77, 121, 74, 10, 0, 135, 10, 20, 0, 7, 6, 11, 9, 135, 9, 2, 0, 1, 74, 192, 0, 97, 0, 74, 10, 1, 74, 192, 0, 3, 74, 0, 74, 109, 74, 4, 9, 119, 0, 11, 0, 1, 77, 0, 0, 1, 76, 16, 0, 2, 75, 0, 0, 17, 19, 10, 0, 25, 78, 3, 8, 135, 74, 5, 0, 77, 76, 75, 78, 1, 78, 1, 0, 135, 74, 13, 0, 78, 0, 0, 0, 106, 6, 0, 28, 120, 6, 3, 0, 1, 12, 0, 0, 119, 0, 18, 0, 135, 7, 123, 0, 6, 0, 0, 0, 120, 7, 14, 0, 106, 78, 0, 28, 109, 3, 16, 78, 1, 74, 0, 0, 1, 75, 8, 0, 2, 76, 0, 0, 199, 34, 10, 0, 25, 77, 3, 16, 135, 78, 5, 0, 74, 75, 76, 77, 1, 77, 1, 0, 135, 78, 13, 0, 77, 0, 0, 0, 119, 0, 2, 0, 0, 12, 7, 0, 2, 77, 0, 0, 20, 47, 13, 0, 135, 78, 19, 0, 1, 77, 0, 0, 32, 7, 78, 0, 2, 78, 0, 0, 152, 137, 11, 0, 125, 6, 7, 78, 1, 0, 0, 0, 2, 77, 0, 0, 152, 137, 11, 0, 1, 76, 5, 0, 135, 78, 124, 0, 6, 77, 76, 0, 120, 78, 3, 0, 1, 13, 0, 0, 119, 0, 6, 0, 2, 76, 0, 0, 227, 34, 10, 0, 135, 78, 19, 0, 6, 76, 0, 0, 33, 13, 78, 0, 2, 78, 0, 0, 148, 117, 9, 0, 2, 76, 0, 0, 148, 117, 9, 0, 82, 76, 76, 0, 38, 77, 13, 1, 19, 76, 76, 77, 85, 78, 76, 0, 135, 13, 125, 0, 97, 3, 71, 13, 120, 13, 7, 0, 1, 78, 244, 255, 135, 76, 46, 0, 6, 78, 0, 0, 1, 78, 1, 0, 135, 76, 13, 0, 78, 0, 0, 0, 106, 1, 0, 52, 121, 1, 17, 0, 106, 76, 0, 48, 26, 78, 1, 1, 41, 78, 78, 4, 3, 76, 76, 78, 106, 7, 76, 8, 82, 78, 0, 0, 25, 78, 78, 20, 2, 77, 0, 0, 207, 92, 11, 0, 34, 75, 7, 0, 41, 75, 75, 31, 42, 75, 75, 31, 1, 74, 0, 0, 135, 76, 126, 0, 78, 77, 7, 75, 74, 0, 0, 0, 33, 7, 12, 0, 106, 76, 0, 44, 33, 76, 76, 0, 19, 76, 7, 76, 121, 76, 30, 0, 25, 1, 12, 20, 82, 76, 1, 0, 121, 76, 27, 0, 2, 74, 0, 0, 219, 92, 11, 0, 1, 75, 0, 0, 1, 77, 0, 0, 1, 78, 2, 0, 135, 76, 127, 0, 1, 74, 75, 77, 78, 0, 0, 0, 121, 76, 18, 0, 106, 76, 0, 40, 106, 78, 0, 44, 26, 78, 78, 1, 41, 78, 78, 4, 3, 76, 76, 78, 106, 1, 76, 8, 82, 78, 0, 0, 25, 78, 78, 20, 2, 77, 0, 0, 219, 92, 11, 0, 34, 75, 1, 0, 41, 75, 75, 31, 42, 75, 75, 31, 1, 74, 0, 0, 135, 76, 126, 0, 78, 77, 1, 75, 74, 0, 0, 0, 106, 76, 0, 60, 33, 76, 76, 0, 19, 76, 7, 76, 121, 76, 26, 0, 25, 7, 12, 20, 82, 76, 7, 0, 121, 76, 23, 0, 2, 74, 0, 0, 10, 95, 11, 0, 1, 75, 0, 0, 1, 77, 0, 0, 1, 78, 2, 0, 135, 76, 127, 0, 7, 74, 75, 77, 78, 0, 0, 0, 121, 76, 14, 0, 82, 78, 0, 0, 25, 78, 78, 20, 2, 77, 0, 0, 10, 95, 11, 0, 106, 75, 0, 56, 106, 74, 0, 60, 26, 74, 74, 1, 41, 74, 74, 4, 3, 75, 75, 74, 106, 75, 75, 8, 1, 74, 0, 0, 135, 76, 4, 0, 78, 77, 75, 74, 106, 7, 0, 68, 121, 7, 13, 0, 82, 74, 0, 0, 25, 74, 74, 20, 2, 75, 0, 0, 34, 64, 12, 0, 106, 77, 0, 64, 26, 78, 7, 1, 41, 78, 78, 4, 3, 77, 77, 78, 106, 77, 77, 8, 1, 78, 0, 0, 135, 76, 4, 0, 74, 75, 77, 78, 106, 7, 0, 76, 121, 7, 13, 0, 82, 78, 0, 0, 25, 78, 78, 20, 2, 77, 0, 0, 4, 64, 12, 0, 106, 75, 0, 72, 26, 74, 7, 1, 41, 74, 74, 4, 3, 75, 75, 74, 106, 75, 75, 8, 1, 74, 0, 0, 135, 76, 4, 0, 78, 77, 75, 74, 106, 7, 0, 36, 1, 76, 0, 0, 47, 76, 76, 7, 160, 190, 0, 0, 106, 1, 0, 32, 1, 4, 0, 0, 1, 5, 0, 0, 41, 74, 5, 4, 94, 74, 1, 74, 2, 75, 0, 0, 61, 95, 13, 0, 135, 76, 19, 0, 74, 75, 0, 0, 120, 76, 5, 0, 41, 76, 5, 4, 3, 76, 1, 76, 106, 14, 76, 8, 119, 0, 2, 0, 0, 14, 4, 0, 25, 5, 5, 1, 56, 76, 7, 5, 104, 187, 0, 0, 0, 4, 14, 0, 119, 0, 240, 255, 1, 76, 0, 0, 47, 76, 76, 7, 172, 188, 0, 0, 106, 4, 0, 32, 1, 5, 0, 0, 1, 1, 0, 0, 41, 75, 1, 4, 94, 75, 4, 75, 2, 74, 0, 0, 241, 162, 10, 0, 135, 76, 19, 0, 75, 74, 0, 0, 120, 76, 5, 0, 41, 76, 1, 4, 3, 76, 4, 76, 106, 15, 76, 8, 119, 0, 2, 0, 0, 15, 5, 0, 25, 1, 1, 1, 52, 76, 1, 7, 196, 187, 0, 0, 0, 5, 15, 0, 119, 0, 240, 255, 1, 76, 0, 0, 47, 76, 76, 7, 156, 188, 0, 0, 106, 5, 0, 32, 1, 1, 0, 0, 1, 4, 0, 0, 41, 74, 4, 4, 94, 74, 5, 74, 2, 75, 0, 0, 98, 106, 12, 0, 135, 76, 19, 0, 74, 75, 0, 0, 120, 76, 5, 0, 41, 76, 4, 4, 3, 76, 5, 76, 106, 16, 76, 8, 119, 0, 2, 0, 0, 16, 1, 0, 25, 4, 4, 1, 52, 76, 4, 7, 32, 188, 0, 0, 0, 1, 16, 0, 119, 0, 240, 255, 1, 76, 0, 0, 47, 76, 76, 7, 140, 188, 0, 0, 106, 1, 0, 32, 1, 4, 0, 0, 1, 5, 0, 0, 41, 75, 4, 4, 94, 75, 1, 75, 2, 74, 0, 0, 171, 0, 12, 0, 135, 76, 19, 0, 75, 74, 0, 0, 120, 76, 5, 0, 41, 76, 4, 4, 3, 76, 1, 76, 106, 17, 76, 8, 119, 0, 2, 0, 0, 17, 5, 0, 25, 4, 4, 1, 45, 76, 4, 7, 132, 188, 0, 0, 0, 18, 15, 0, 0, 19, 16, 0, 0, 20, 17, 0, 119, 0, 14, 0, 0, 5, 17, 0, 119, 0, 236, 255, 0, 18, 15, 0, 0, 19, 16, 0, 1, 20, 0, 0, 119, 0, 8, 0, 0, 18, 15, 0, 1, 19, 0, 0, 1, 20, 0, 0, 119, 0, 4, 0, 1, 18, 0, 0, 1, 19, 0, 0, 1, 20, 0, 0, 120, 14, 3, 0, 1, 21, 0, 0, 119, 0, 8, 0, 1, 76, 0, 0, 1, 74, 0, 0, 135, 5, 128, 0, 14, 76, 74, 0, 1, 74, 20, 5, 97, 13, 74, 5, 1, 21, 1, 0, 120, 18, 3, 0, 1, 22, 0, 0, 119, 0, 8, 0, 1, 74, 1, 0, 1, 76, 0, 0, 135, 5, 128, 0, 18, 74, 76, 0, 1, 76, 24, 5, 97, 13, 76, 5, 1, 22, 1, 0, 120, 19, 3, 0, 1, 23, 0, 0, 119, 0, 8, 0, 1, 76, 3, 0, 1, 74, 0, 0, 135, 5, 128, 0, 19, 76, 74, 0, 1, 74, 28, 5, 97, 13, 74, 5, 1, 23, 1, 0, 120, 20, 8, 0, 121, 21, 4, 0, 1, 24, 0, 0, 1, 2, 59, 0, 119, 0, 16, 0, 1, 25, 0, 0, 1, 2, 60, 0, 119, 0, 13, 0, 1, 74, 2, 0, 1, 76, 0, 0, 135, 5, 128, 0, 20, 74, 76, 0, 1, 76, 32, 5, 97, 13, 76, 5, 121, 21, 4, 0, 1, 24, 1, 0, 1, 2, 59, 0, 119, 0, 3, 0, 1, 25, 1, 0, 1, 2, 60, 0, 32, 76, 2, 59, 121, 76, 13, 0, 1, 76, 112, 4, 1, 74, 20, 5, 94, 74, 13, 74, 106, 74, 74, 12, 97, 13, 76, 74, 121, 22, 4, 0, 0, 26, 24, 0, 1, 2, 61, 0, 119, 0, 15, 0, 0, 27, 24, 0, 1, 2, 62, 0, 119, 0, 12, 0, 32, 74, 2, 60, 121, 74, 10, 0, 1, 74, 112, 4, 1, 76, 0, 0, 97, 13, 74, 76, 121, 22, 4, 0, 0, 26, 25, 0, 1, 2, 61, 0, 119, 0, 3, 0, 0, 27, 25, 0, 1, 2, 62, 0, 32, 76, 2, 61, 121, 76, 13, 0, 1, 76, 116, 4, 1, 74, 24, 5, 94, 74, 13, 74, 106, 74, 74, 12, 97, 13, 76, 74, 121, 23, 4, 0, 0, 28, 26, 0, 1, 2, 63, 0, 119, 0, 15, 0, 0, 29, 26, 0, 1, 2, 64, 0, 119, 0, 12, 0, 32, 74, 2, 62, 121, 74, 10, 0, 1, 74, 116, 4, 1, 76, 0, 0, 97, 13, 74, 76, 121, 23, 4, 0, 0, 28, 27, 0, 1, 2, 63, 0, 119, 0, 3, 0, 0, 29, 27, 0, 1, 2, 64, 0, 32, 76, 2, 63, 121, 76, 9, 0, 1, 76, 120, 4, 1, 74, 28, 5, 94, 74, 13, 74, 106, 74, 74, 12, 97, 13, 76, 74, 120, 28, 11, 0, 1, 30, 0, 0, 119, 0, 23, 0, 32, 74, 2, 64, 121, 74, 7, 0, 1, 74, 120, 4, 1, 76, 0, 0, 97, 13, 74, 76, 120, 29, 3, 0, 1, 30, 0, 0, 119, 0, 15, 0, 1, 76, 32, 5, 94, 76, 13, 76, 106, 30, 76, 12, 119, 0, 11, 0, 1, 76, 112, 4, 1, 74, 0, 0, 97, 13, 76, 74, 1, 74, 116, 4, 1, 76, 0, 0, 97, 13, 74, 76, 1, 76, 120, 4, 1, 74, 0, 0, 97, 13, 76, 74, 1, 30, 0, 0, 1, 74, 60, 5, 97, 13, 74, 30, 1, 74, 72, 4, 94, 30, 13, 74, 1, 74, 72, 4, 39, 76, 30, 4, 97, 13, 74, 76, 1, 76, 228, 0, 94, 76, 0, 76, 121, 76, 5, 0, 1, 76, 72, 4, 1, 74, 4, 4, 20, 74, 30, 74, 97, 13, 76, 74, 2, 74, 0, 0, 248, 117, 9, 0, 82, 30, 74, 0, 1, 74, 160, 4, 2, 76, 0, 0, 244, 117, 9, 0, 82, 76, 76, 0, 97, 13, 74, 76, 1, 76, 160, 4, 3, 76, 13, 76, 109, 76, 4, 30, 82, 74, 0, 0, 106, 74, 74, 20, 2, 75, 0, 0, 238, 34, 10, 0, 1, 77, 0, 0, 1, 78, 1, 0, 135, 76, 6, 0, 74, 75, 77, 78, 120, 76, 12, 0, 82, 78, 0, 0, 25, 78, 78, 20, 2, 77, 0, 0, 238, 34, 10, 0, 2, 75, 0, 0, 65, 62, 13, 0, 1, 74, 16, 0, 135, 76, 4, 0, 78, 77, 75, 74, 1, 31, 1, 0, 119, 0, 2, 0, 1, 31, 0, 0, 3, 76, 3, 71, 82, 74, 0, 0, 25, 74, 74, 20, 134, 30, 0, 0, 16, 31, 1, 0, 76, 6, 12, 74, 34, 74, 30, 0, 121, 74, 21, 0, 135, 74, 46, 0, 6, 30, 0, 0, 2, 74, 0, 0, 8, 175, 173, 176, 46, 74, 30, 74, 196, 191, 0, 0, 1, 76, 1, 0, 135, 74, 13, 0, 76, 0, 0, 0, 109, 3, 24, 6, 1, 76, 0, 0, 1, 75, 16, 0, 2, 77, 0, 0, 252, 34, 10, 0, 25, 78, 3, 24, 135, 74, 5, 0, 76, 75, 77, 78, 1, 78, 1, 0, 135, 74, 13, 0, 78, 0, 0, 0, 121, 31, 9, 0, 82, 78, 0, 0, 25, 78, 78, 20, 2, 77, 0, 0, 238, 34, 10, 0, 1, 75, 0, 0, 1, 76, 1, 0, 135, 74, 4, 0, 78, 77, 75, 76, 82, 31, 0, 0, 25, 76, 31, 20, 106, 75, 31, 16, 135, 74, 129, 0, 76, 75, 0, 0, 82, 75, 0, 0, 106, 75, 75, 20, 135, 74, 130, 0, 75, 0, 0, 0, 94, 31, 3, 71, 106, 74, 31, 24, 120, 74, 3, 0, 0, 32, 31, 0, 119, 0, 71, 0, 1, 30, 0, 0, 0, 12, 31, 0, 106, 74, 12, 28, 41, 75, 30, 2, 94, 13, 74, 75, 1, 74, 0, 0, 106, 75, 0, 36, 47, 74, 74, 75, 16, 193, 0, 0, 1, 29, 0, 0, 1, 28, 0, 0, 106, 74, 0, 32, 41, 75, 28, 4, 94, 74, 74, 75, 135, 27, 131, 0, 12, 13, 74, 0, 1, 74, 0, 0, 47, 74, 74, 27, 172, 192, 0, 0, 106, 74, 0, 32, 41, 75, 28, 4, 3, 74, 74, 75, 106, 33, 74, 8, 119, 0, 4, 0, 34, 74, 27, 0, 120, 74, 42, 0, 0, 33, 29, 0, 25, 28, 28, 1, 106, 74, 0, 36, 56, 74, 74, 28, 208, 192, 0, 0, 0, 29, 33, 0, 119, 0, 235, 255, 1, 74, 176, 0, 94, 29, 13, 74, 120, 33, 4, 0, 0, 34, 29, 0, 1, 2, 88, 0, 119, 0, 14, 0, 82, 75, 29, 0, 1, 76, 0, 0, 135, 74, 128, 0, 33, 75, 76, 0, 25, 28, 74, 12, 1, 74, 176, 0, 94, 74, 13, 74, 82, 76, 28, 0, 109, 74, 4, 76, 119, 0, 4, 0, 1, 76, 176, 0, 94, 34, 13, 76, 1, 2, 88, 0, 32, 76, 2, 88, 121, 76, 5, 0, 1, 2, 0, 0, 106, 74, 34, 4, 135, 76, 85, 0, 74, 0, 0, 0, 25, 30, 30, 1, 94, 28, 3, 71, 106, 76, 28, 24, 50, 76, 76, 30, 80, 193, 0, 0, 0, 32, 28, 0, 119, 0, 6, 0, 0, 12, 28, 0, 119, 0, 192, 255, 1, 74, 1, 0, 135, 76, 13, 0, 74, 0, 0, 0, 2, 76, 0, 0, 160, 117, 9, 0, 82, 76, 76, 0, 121, 76, 48, 0, 82, 76, 0, 0, 106, 76, 76, 16, 135, 34, 132, 0, 32, 76, 0, 0, 1, 76, 240, 0, 97, 3, 76, 34, 94, 32, 3, 71, 106, 33, 32, 24, 134, 31, 0, 0, 4, 105, 0, 0, 32, 34, 0, 0, 1, 76, 0, 0, 47, 76, 76, 33, 212, 193, 0, 0, 1, 34, 0, 0, 1, 74, 240, 0, 94, 74, 3, 74, 41, 75, 34, 2, 3, 74, 74, 75, 135, 76, 79, 0, 74, 0, 0, 0, 25, 34, 34, 1, 53, 76, 34, 33, 176, 193, 0, 0, 1, 74, 240, 0, 3, 74, 3, 74, 135, 76, 73, 0, 74, 0, 0, 0, 34, 76, 31, 0, 121, 76, 18, 0, 109, 3, 32, 6, 1, 74, 0, 0, 1, 75, 8, 0, 2, 77, 0, 0, 19, 35, 10, 0, 25, 78, 3, 32, 135, 76, 5, 0, 74, 75, 77, 78, 94, 76, 3, 71, 106, 76, 76, 24, 120, 76, 7, 0, 3, 78, 3, 71, 135, 76, 133, 0, 78, 0, 0, 0, 1, 78, 1, 0, 135, 76, 13, 0, 78, 0, 0, 0, 106, 31, 0, 16, 25, 76, 0, 16, 106, 33, 76, 4, 106, 78, 0, 8, 32, 78, 78, 0, 121, 78, 8, 0, 25, 78, 0, 8, 106, 78, 78, 4, 2, 77, 0, 0, 0, 0, 0, 128, 13, 78, 78, 77, 0, 76, 78, 0, 119, 0, 3, 0, 1, 78, 0, 0, 0, 76, 78, 0, 121, 76, 80, 0, 32, 76, 31, 0, 2, 78, 0, 0, 0, 0, 0, 128, 13, 78, 33, 78, 19, 76, 76, 78, 121, 76, 3, 0, 1, 2, 108, 0, 119, 0, 95, 0, 1, 76, 255, 255, 15, 76, 76, 33, 32, 78, 33, 255, 1, 77, 255, 255, 16, 77, 77, 31, 19, 78, 78, 77, 20, 76, 76, 78, 121, 76, 11, 0, 1, 78, 0, 0, 1, 77, 16, 0, 2, 75, 0, 0, 106, 35, 10, 0, 25, 74, 3, 48, 135, 76, 5, 0, 78, 77, 75, 74, 1, 74, 1, 0, 135, 76, 13, 0, 74, 0, 0, 0, 94, 76, 3, 71, 1, 74, 48, 4, 3, 34, 76, 74, 82, 32, 34, 0, 106, 12, 34, 4, 1, 74, 0, 0, 15, 74, 74, 12, 32, 76, 12, 0, 1, 75, 0, 0, 16, 75, 75, 32, 19, 76, 76, 75, 20, 74, 74, 76, 120, 74, 11, 0, 109, 3, 64, 6, 1, 76, 0, 0, 1, 75, 24, 0, 2, 77, 0, 0, 203, 35, 10, 0, 25, 78, 3, 64, 135, 74, 5, 0, 76, 75, 77, 78, 1, 2, 108, 0, 119, 0, 54, 0, 135, 34, 44, 0, 32, 12, 31, 33, 135, 12, 2, 0, 109, 0, 8, 34, 25, 74, 0, 8, 109, 74, 4, 12, 1, 74, 0, 0, 49, 74, 74, 12, 100, 195, 0, 0, 0, 35, 34, 0, 0, 36, 12, 0, 119, 0, 42, 0, 109, 3, 56, 6, 1, 78, 0, 0, 1, 77, 24, 0, 2, 75, 0, 0, 147, 35, 10, 0, 25, 76, 3, 56, 135, 74, 5, 0, 78, 77, 75, 76, 1, 76, 0, 0, 109, 0, 8, 76, 25, 76, 0, 8, 2, 74, 0, 0, 0, 0, 0, 128, 109, 76, 4, 74, 1, 35, 0, 0, 2, 36, 0, 0, 0, 0, 0, 128, 119, 0, 24, 0, 32, 74, 31, 0, 2, 76, 0, 0, 0, 0, 0, 128, 13, 76, 33, 76, 19, 74, 74, 76, 121, 74, 3, 0, 1, 2, 108, 0, 119, 0, 16, 0, 109, 3, 40, 6, 1, 76, 0, 0, 1, 75, 24, 0, 2, 77, 0, 0, 56, 35, 10, 0, 25, 78, 3, 40, 135, 74, 5, 0, 76, 75, 77, 78, 1, 78, 0, 0, 109, 0, 16, 78, 25, 78, 0, 16, 2, 74, 0, 0, 0, 0, 0, 128, 109, 78, 4, 74, 1, 2, 108, 0, 32, 74, 2, 108, 121, 74, 4, 0, 106, 35, 0, 8, 25, 74, 0, 8, 106, 36, 74, 4, 32, 74, 35, 0, 2, 78, 0, 0, 0, 0, 0, 128, 13, 78, 36, 78, 19, 74, 74, 78, 0, 33, 74, 0, 1, 74, 0, 0, 125, 31, 33, 74, 35, 0, 0, 0, 1, 74, 0, 0, 125, 35, 33, 74, 36, 0, 0, 0, 106, 74, 0, 24, 120, 74, 23, 0, 94, 74, 3, 71, 1, 78, 40, 4, 3, 36, 74, 78, 82, 12, 36, 0, 106, 34, 36, 4, 32, 78, 12, 0, 2, 74, 0, 0, 0, 0, 0, 128, 13, 74, 34, 74, 19, 78, 78, 74, 0, 36, 78, 0, 1, 74, 0, 0, 125, 78, 36, 74, 12, 0, 0, 0, 1, 77, 0, 0, 125, 74, 36, 77, 34, 0, 0, 0, 135, 32, 44, 0, 78, 74, 31, 35, 0, 37, 32, 0, 135, 38, 2, 0, 119, 0, 3, 0, 0, 37, 31, 0, 0, 38, 35, 0, 120, 33, 72, 0, 94, 35, 3, 71, 106, 74, 35, 4, 106, 74, 74, 8, 2, 78, 0, 0, 0, 0, 0, 4, 19, 74, 74, 78, 120, 74, 32, 0, 106, 31, 35, 24, 121, 31, 27, 0, 106, 32, 35, 28, 1, 34, 0, 0, 41, 74, 34, 2, 94, 74, 32, 74, 1, 78, 176, 0, 94, 74, 74, 78, 106, 74, 74, 88, 121, 74, 3, 0, 1, 39, 0, 0, 119, 0, 7, 0, 25, 34, 34, 1, 50, 74, 31, 34, 24, 197, 0, 0, 1, 39, 1, 0, 119, 0, 2, 0, 119, 0, 243, 255, 2, 74, 0, 0, 126, 2, 254, 255, 1, 78, 255, 255, 135, 31, 44, 0, 37, 38, 74, 78, 135, 34, 2, 0, 120, 39, 4, 0, 0, 40, 31, 0, 0, 41, 34, 0, 119, 0, 6, 0, 0, 40, 37, 0, 0, 41, 38, 0, 119, 0, 3, 0, 0, 40, 37, 0, 0, 41, 38, 0, 1, 78, 0, 0, 1, 77, 255, 255, 1, 75, 0, 0, 2, 76, 0, 0, 0, 0, 0, 128, 1, 79, 0, 0, 135, 74, 134, 0, 35, 77, 75, 76, 40, 41, 40, 41, 79, 0, 0, 0, 56, 78, 78, 74, 212, 197, 0, 0, 109, 3, 72, 6, 25, 78, 3, 72, 77, 74, 37, 0, 61, 79, 0, 0, 0, 0, 128, 79, 76, 76, 38, 0, 65, 79, 79, 76, 63, 74, 74, 79, 60, 79, 0, 0, 64, 66, 15, 0, 66, 74, 74, 79, 111, 78, 8, 74, 1, 78, 0, 0, 1, 79, 24, 0, 2, 76, 0, 0, 248, 35, 10, 0, 25, 75, 3, 72, 135, 74, 5, 0, 78, 79, 76, 75, 94, 41, 3, 71, 106, 74, 41, 24, 120, 74, 3, 0, 0, 42, 41, 0, 119, 0, 148, 4, 1, 40, 0, 0, 106, 74, 41, 28, 41, 75, 40, 2, 94, 39, 74, 75, 1, 74, 176, 0, 94, 33, 39, 74, 1, 74, 96, 1, 135, 34, 93, 0, 74, 0, 0, 0, 135, 31, 135, 0, 1, 74, 236, 0, 97, 3, 74, 31, 1, 74, 236, 0, 3, 74, 3, 74, 2, 75, 0, 0, 83, 54, 12, 0, 1, 76, 0, 0, 1, 79, 0, 0, 1, 78, 0, 0, 135, 31, 127, 0, 74, 75, 76, 79, 78, 0, 0, 0, 120, 34, 3, 0, 1, 2, 124, 0, 119, 0, 21, 3, 2, 78, 0, 0, 216, 187, 65, 0, 82, 78, 78, 0, 1, 79, 4, 0, 2, 76, 0, 0, 220, 187, 65, 0, 2, 75, 0, 0, 220, 187, 65, 0, 82, 75, 75, 0, 25, 75, 75, 1, 135, 32, 136, 0, 78, 79, 76, 75, 2, 75, 0, 0, 216, 187, 65, 0, 85, 75, 32, 0, 2, 75, 0, 0, 220, 187, 65, 0, 82, 75, 75, 0, 26, 75, 75, 1, 41, 75, 75, 2, 97, 32, 75, 34, 109, 34, 4, 39, 2, 75, 0, 0, 228, 187, 65, 0, 82, 75, 75, 0, 85, 34, 75, 0, 1, 76, 1, 0, 109, 34, 8, 76, 1, 75, 48, 0, 109, 39, 52, 75, 1, 76, 0, 0, 109, 34, 120, 76, 25, 76, 34, 120, 1, 75, 0, 0, 109, 76, 4, 75, 1, 76, 255, 255, 109, 34, 96, 76, 25, 76, 34, 96, 2, 75, 0, 0, 255, 255, 255, 127, 109, 76, 4, 75, 1, 76, 0, 0, 109, 34, 104, 76, 25, 76, 34, 104, 2, 75, 0, 0, 0, 0, 0, 128, 109, 76, 4, 75, 59, 76, 1, 0, 99, 34, 67, 76, 1, 76, 0, 0, 106, 75, 0, 108, 47, 76, 76, 75, 124, 199, 0, 0, 1, 32, 0, 0, 106, 76, 0, 104, 41, 75, 32, 4, 94, 76, 76, 75, 135, 13, 131, 0, 41, 39, 76, 0, 1, 76, 0, 0, 47, 76, 76, 13, 92, 199, 0, 0, 106, 75, 0, 104, 41, 79, 32, 4, 3, 75, 75, 79, 110, 75, 75, 8, 99, 34, 67, 75, 119, 0, 5, 0, 34, 75, 13, 0, 121, 75, 3, 0, 1, 2, 130, 0, 119, 0, 205, 2, 25, 32, 32, 1, 106, 75, 0, 108, 54, 75, 32, 75, 36, 199, 0, 0, 1, 75, 160, 0, 1, 76, 1, 0, 97, 34, 75, 76, 1, 76, 0, 0, 1, 75, 148, 0, 94, 75, 0, 75, 47, 76, 76, 75, 8, 200, 0, 0, 1, 32, 0, 0, 1, 76, 144, 0, 94, 76, 0, 76, 41, 75, 32, 4, 94, 76, 76, 75, 135, 13, 131, 0, 41, 39, 76, 0, 1, 76, 0, 0, 47, 76, 76, 13, 228, 199, 0, 0, 1, 76, 160, 0, 1, 75, 144, 0, 94, 75, 0, 75, 41, 79, 32, 4, 3, 75, 75, 79, 106, 75, 75, 8, 97, 34, 76, 75, 119, 0, 5, 0, 34, 75, 13, 0, 121, 75, 3, 0, 1, 2, 137, 0, 119, 0, 171, 2, 25, 32, 32, 1, 1, 75, 148, 0, 94, 75, 0, 75], eb + 40960);
                HEAPU8.set([54, 75, 32, 75, 160, 199, 0, 0, 1, 75, 0, 0, 1, 76, 28, 1, 94, 76, 0, 76, 47, 75, 75, 76, 16, 201, 0, 0, 1, 32, 0, 0, 1, 13, 0, 0, 1, 36, 0, 0, 1, 75, 24, 1, 94, 75, 0, 75, 41, 76, 13, 4, 94, 75, 75, 76, 135, 12, 131, 0, 41, 39, 75, 0, 1, 75, 0, 0, 47, 75, 75, 12, 108, 200, 0, 0, 1, 75, 24, 1, 94, 75, 0, 75, 41, 76, 13, 4, 3, 75, 75, 76, 106, 30, 75, 8, 0, 43, 30, 0, 0, 44, 30, 0, 119, 0, 7, 0, 34, 75, 12, 0, 121, 75, 3, 0, 1, 2, 144, 0, 119, 0, 137, 2, 0, 43, 32, 0, 0, 44, 36, 0, 25, 13, 13, 1, 1, 75, 28, 1, 94, 75, 0, 75, 56, 75, 75, 13, 164, 200, 0, 0, 0, 32, 43, 0, 0, 36, 44, 0, 119, 0, 226, 255, 120, 43, 2, 0, 119, 0, 26, 0, 1, 75, 240, 0, 3, 75, 3, 75, 1, 76, 0, 0, 135, 36, 137, 0, 43, 75, 76, 0, 1, 76, 240, 0, 94, 76, 3, 76, 78, 76, 76, 0, 120, 76, 3, 0, 0, 45, 36, 0, 119, 0, 12, 0, 79, 76, 44, 0, 103, 75, 44, 1, 41, 75, 75, 8, 20, 76, 76, 75, 103, 75, 44, 2, 41, 75, 75, 16, 20, 76, 76, 75, 103, 75, 44, 3, 41, 75, 75, 24, 20, 76, 76, 75, 0, 45, 76, 0, 1, 76, 176, 0, 94, 76, 39, 76, 109, 76, 8, 45, 1, 76, 0, 0, 106, 75, 0, 36, 47, 76, 76, 75, 200, 201, 0, 0, 1, 36, 0, 0, 1, 32, 0, 0, 106, 76, 0, 32, 41, 75, 32, 4, 94, 76, 76, 75, 135, 13, 131, 0, 41, 39, 76, 0, 1, 76, 0, 0, 47, 76, 76, 13, 92, 201, 0, 0, 106, 76, 0, 32, 41, 75, 32, 4, 3, 76, 76, 75, 106, 46, 76, 8, 119, 0, 6, 0, 34, 76, 13, 0, 121, 76, 3, 0, 1, 2, 156, 0, 119, 0, 77, 2, 0, 46, 36, 0, 25, 32, 32, 1, 106, 76, 0, 36, 56, 76, 76, 32, 136, 201, 0, 0, 0, 36, 46, 0, 119, 0, 233, 255, 1, 76, 176, 0, 94, 36, 39, 76, 120, 46, 4, 0, 0, 47, 36, 0, 1, 2, 160, 0, 119, 0, 14, 0, 82, 76, 36, 0, 1, 75, 0, 0, 135, 32, 128, 0, 46, 76, 75, 0, 1, 75, 176, 0, 94, 75, 39, 75, 106, 76, 32, 12, 109, 75, 4, 76, 0, 48, 32, 0, 119, 0, 4, 0, 1, 76, 176, 0, 94, 47, 39, 76, 1, 2, 160, 0, 1, 76, 160, 0, 45, 76, 2, 76, 240, 201, 0, 0, 1, 2, 0, 0, 106, 76, 47, 4, 135, 48, 85, 0, 76, 0, 0, 0, 109, 34, 24, 48, 82, 76, 0, 0, 106, 76, 76, 16, 106, 75, 34, 4, 1, 79, 176, 0, 94, 75, 75, 79, 106, 75, 75, 4, 135, 32, 138, 0, 76, 75, 41, 39, 48, 0, 0, 0, 97, 34, 69, 32, 1, 75, 252, 0, 1, 76, 255, 255, 97, 34, 75, 76, 1, 76, 0, 0, 1, 75, 164, 1, 94, 75, 0, 75, 47, 76, 76, 75, 168, 202, 0, 0, 1, 32, 0, 0, 1, 76, 160, 1, 94, 76, 0, 76, 41, 75, 32, 4, 94, 76, 76, 75, 135, 36, 131, 0, 41, 39, 76, 0, 1, 76, 0, 0, 47, 76, 76, 36, 132, 202, 0, 0, 1, 76, 252, 0, 1, 75, 160, 1, 94, 75, 0, 75, 41, 79, 32, 4, 3, 75, 75, 79, 106, 75, 75, 8, 97, 34, 76, 75, 119, 0, 5, 0, 34, 75, 36, 0, 121, 75, 3, 0, 1, 2, 166, 0, 119, 0, 3, 2, 25, 32, 32, 1, 1, 75, 164, 1, 94, 75, 0, 75, 54, 75, 32, 75, 64, 202, 0, 0, 1, 75, 0, 0, 1, 76, 228, 1, 94, 76, 0, 76, 47, 75, 75, 76, 100, 203, 0, 0, 1, 32, 0, 0, 1, 36, 0, 0, 1, 75, 224, 1, 94, 75, 0, 75, 41, 76, 36, 4, 94, 75, 75, 76, 135, 13, 131, 0, 41, 39, 75, 0, 1, 75, 0, 0, 47, 75, 75, 13, 0, 203, 0, 0, 1, 75, 224, 1, 94, 75, 0, 75, 41, 76, 36, 4, 3, 75, 75, 76, 106, 49, 75, 8, 119, 0, 6, 0, 34, 75, 13, 0, 121, 75, 3, 0, 1, 2, 174, 0, 119, 0, 228, 1, 0, 49, 32, 0, 25, 36, 36, 1, 1, 75, 228, 1, 94, 75, 0, 75, 56, 75, 75, 36, 48, 203, 0, 0, 0, 32, 49, 0, 119, 0, 230, 255, 1, 76, 240, 255, 109, 34, 12, 76, 120, 49, 2, 0, 119, 0, 12, 0, 1, 75, 236, 0, 3, 75, 3, 75, 25, 79, 34, 12, 135, 76, 139, 0, 75, 31, 49, 79, 34, 76, 76, 0, 121, 76, 5, 0, 1, 2, 178, 0, 119, 0, 207, 1, 1, 79, 240, 255, 109, 34, 12, 79, 1, 76, 0, 0, 109, 34, 88, 76, 25, 76, 34, 88, 2, 79, 0, 0, 0, 0, 0, 128, 109, 76, 4, 79, 106, 79, 34, 24, 135, 31, 140, 0, 79, 0, 0, 0, 109, 34, 20, 31, 120, 31, 3, 0, 1, 2, 180, 0, 119, 0, 192, 1, 135, 79, 83, 0, 31, 33, 0, 0, 34, 79, 79, 0, 121, 79, 3, 0, 1, 2, 182, 0, 119, 0, 186, 1, 1, 79, 228, 0, 94, 79, 0, 79, 121, 79, 8, 0, 106, 79, 34, 20, 25, 31, 79, 60, 82, 79, 31, 0, 2, 76, 0, 0, 0, 0, 128, 0, 20, 79, 79, 76, 85, 31, 79, 0, 82, 79, 33, 0, 1, 77, 255, 255, 1, 74, 6, 0, 138, 79, 77, 74, 16, 204, 0, 0, 20, 204, 0, 0, 120, 208, 0, 0, 20, 209, 0, 0, 92, 210, 0, 0, 96, 210, 0, 0, 1, 2, 20, 1, 119, 0, 164, 1, 119, 0, 149, 1, 106, 76, 34, 24, 120, 76, 5, 0, 106, 76, 33, 4, 135, 31, 85, 0, 76, 0, 0, 0, 109, 34, 24, 31, 106, 31, 39, 8, 1, 76, 168, 2, 94, 32, 31, 76, 106, 36, 34, 20, 121, 32, 11, 0, 1, 76, 168, 2, 97, 36, 76, 32, 106, 75, 31, 92, 109, 36, 92, 75, 106, 76, 31, 96, 109, 36, 96, 76, 106, 75, 31, 100, 109, 36, 100, 75, 106, 76, 31, 104, 109, 36, 104, 76, 25, 76, 39, 68, 106, 31, 76, 4, 1, 76, 248, 2, 106, 75, 39, 68, 97, 36, 76, 75, 1, 75, 248, 2, 3, 75, 36, 75, 109, 75, 4, 31, 1, 75, 0, 0, 106, 76, 0, 60, 47, 75, 75, 76, 40, 205, 0, 0, 1, 31, 0, 0, 1, 36, 0, 0, 106, 75, 0, 56, 41, 76, 36, 4, 94, 75, 75, 76, 135, 32, 131, 0, 41, 39, 75, 0, 1, 75, 0, 0, 47, 75, 75, 32, 212, 204, 0, 0, 106, 75, 0, 56, 41, 76, 36, 4, 3, 75, 75, 76, 106, 50, 75, 8, 119, 0, 6, 0, 34, 75, 32, 0, 121, 75, 3, 0, 1, 2, 195, 0, 119, 0, 111, 1, 0, 50, 31, 0, 25, 36, 36, 1, 106, 75, 0, 60, 56, 75, 75, 36, 0, 205, 0, 0, 0, 31, 50, 0, 119, 0, 233, 255, 120, 50, 2, 0, 119, 0, 9, 0, 1, 76, 144, 0, 3, 76, 34, 76, 135, 75, 141, 0, 76, 50, 0, 0, 34, 75, 75, 0, 121, 75, 3, 0, 1, 2, 199, 0, 119, 0, 94, 1, 1, 75, 152, 0, 1, 76, 255, 255, 97, 34, 75, 76, 1, 76, 0, 0, 1, 75, 108, 1, 94, 75, 0, 75, 47, 76, 76, 75, 180, 205, 0, 0, 1, 31, 0, 0, 1, 76, 104, 1, 94, 76, 0, 76, 41, 75, 31, 4, 94, 76, 76, 75, 135, 36, 131, 0, 41, 39, 76, 0, 1, 76, 0, 0, 47, 76, 76, 36, 144, 205, 0, 0, 1, 76, 152, 0, 1, 75, 104, 1, 94, 75, 0, 75, 41, 78, 31, 4, 3, 75, 75, 78, 106, 75, 75, 8, 97, 34, 76, 75, 119, 0, 5, 0, 34, 75, 36, 0, 121, 75, 3, 0, 1, 2, 205, 0, 119, 0, 64, 1, 25, 31, 31, 1, 1, 75, 108, 1, 94, 75, 0, 75, 54, 75, 31, 75, 76, 205, 0, 0, 1, 75, 0, 0, 106, 76, 0, 124, 47, 75, 75, 76, 228, 206, 0, 0, 1, 31, 0, 0, 1, 36, 0, 0, 106, 75, 0, 120, 41, 76, 36, 4, 94, 75, 75, 76, 135, 32, 131, 0, 41, 39, 75, 0, 1, 75, 0, 0, 47, 75, 75, 32, 0, 206, 0, 0, 106, 75, 0, 120, 41, 76, 36, 4, 3, 75, 75, 76, 106, 51, 75, 8, 119, 0, 6, 0, 34, 75, 32, 0, 121, 75, 3, 0, 1, 2, 212, 0, 119, 0, 36, 1, 0, 51, 31, 0, 25, 36, 36, 1, 106, 75, 0, 124, 56, 75, 75, 36, 44, 206, 0, 0, 0, 31, 51, 0, 119, 0, 233, 255, 120, 51, 2, 0, 119, 0, 45, 0, 2, 76, 0, 0, 166, 36, 10, 0, 135, 75, 19, 0, 51, 76, 0, 0, 32, 31, 75, 0, 2, 75, 0, 0, 132, 42, 13, 0, 125, 52, 31, 75, 51, 0, 0, 0, 2, 76, 0, 0, 135, 107, 13, 0, 135, 75, 19, 0, 52, 76, 0, 0, 120, 75, 5, 0, 1, 75, 0, 1, 1, 76, 0, 0, 97, 34, 75, 76, 119, 0, 27, 0, 2, 75, 0, 0, 148, 55, 13, 0, 135, 76, 19, 0, 52, 75, 0, 0, 120, 76, 5, 0, 1, 76, 0, 1, 1, 75, 1, 0, 97, 34, 76, 75, 119, 0, 18, 0, 1, 75, 0, 1, 94, 75, 34, 75, 120, 75, 15, 0, 135, 31, 142, 0, 52, 0, 0, 0, 120, 31, 6, 0, 1, 75, 0, 1, 94, 75, 34, 75, 120, 75, 9, 0, 1, 2, 223, 0, 119, 0, 245, 0, 1, 75, 0, 1, 1, 76, 2, 0, 97, 34, 75, 76, 1, 76, 4, 1, 97, 34, 76, 31, 119, 0, 1, 0, 1, 76, 0, 0, 94, 75, 0, 70, 47, 76, 76, 75, 128, 207, 0, 0, 1, 31, 0, 0, 1, 36, 0, 0, 94, 76, 0, 67, 41, 75, 36, 4, 94, 76, 76, 75, 135, 32, 131, 0, 41, 39, 76, 0, 1, 76, 0, 0, 47, 76, 76, 32, 48, 207, 0, 0, 94, 76, 0, 67, 41, 75, 36, 4, 3, 76, 76, 75, 106, 53, 76, 8, 119, 0, 6, 0, 34, 76, 32, 0, 121, 76, 3, 0, 1, 2, 232, 0, 119, 0, 216, 0, 0, 53, 31, 0, 25, 36, 36, 1, 94, 76, 0, 70, 56, 76, 76, 36, 92, 207, 0, 0, 0, 31, 53, 0, 119, 0, 233, 255, 120, 53, 2, 0, 119, 0, 8, 0, 135, 31, 143, 0, 53, 0, 0, 0, 1, 76, 8, 1, 97, 34, 76, 31, 120, 31, 3, 0, 1, 2, 236, 0, 119, 0, 200, 0, 1, 76, 0, 0, 94, 75, 0, 69, 47, 76, 76, 75, 72, 208, 0, 0, 1, 31, 0, 0, 1, 36, 0, 0, 94, 76, 0, 68, 41, 75, 36, 4, 94, 76, 76, 75, 135, 32, 131, 0, 41, 39, 76, 0, 1, 76, 0, 0, 47, 76, 76, 32, 204, 207, 0, 0, 94, 76, 0, 68, 41, 75, 36, 4, 3, 76, 76, 75, 106, 54, 76, 8, 119, 0, 6, 0, 34, 76, 32, 0, 121, 76, 3, 0, 1, 2, 242, 0, 119, 0, 177, 0, 0, 54, 31, 0, 25, 36, 36, 1, 94, 76, 0, 69, 56, 76, 76, 36, 248, 207, 0, 0, 0, 31, 54, 0, 119, 0, 233, 255, 120, 54, 3, 0, 1, 2, 247, 0, 119, 0, 19, 0, 135, 31, 144, 0, 54, 0, 0, 0, 1, 76, 12, 1, 97, 34, 76, 31, 33, 76, 31, 255, 120, 76, 13, 0, 1, 76, 152, 0, 97, 3, 76, 54, 1, 75, 0, 0, 1, 78, 8, 0, 2, 74, 0, 0, 220, 36, 10, 0, 1, 77, 152, 0, 3, 77, 3, 77, 135, 76, 5, 0, 75, 78, 74, 77, 119, 0, 2, 0, 1, 2, 247, 0, 1, 76, 247, 0, 45, 76, 2, 76, 104, 208, 0, 0, 1, 2, 0, 0, 1, 76, 12, 1, 1, 77, 255, 255, 97, 34, 76, 77, 1, 77, 32, 1, 1, 76, 255, 255, 97, 34, 77, 76, 119, 0, 124, 0, 1, 76, 156, 0, 2, 77, 0, 0, 255, 255, 255, 127, 97, 34, 76, 77, 1, 77, 0, 0, 1, 76, 212, 1, 94, 76, 0, 76, 47, 77, 77, 76, 8, 209, 0, 0, 1, 31, 0, 0, 1, 77, 208, 1, 94, 77, 0, 77, 41, 76, 31, 4, 94, 77, 77, 76, 135, 36, 131, 0, 41, 39, 77, 0, 1, 77, 0, 0, 47, 77, 77, 36, 228, 208, 0, 0, 1, 77, 156, 0, 1, 76, 208, 1, 94, 76, 0, 76, 41, 74, 31, 4, 3, 76, 76, 74, 106, 76, 76, 8, 97, 34, 77, 76, 119, 0, 5, 0, 34, 76, 36, 0, 121, 76, 3, 0, 1, 2, 254, 0, 119, 0, 107, 0, 25, 31, 31, 1, 1, 76, 212, 1, 94, 76, 0, 76, 54, 76, 31, 76, 160, 208, 0, 0, 135, 76, 145, 0, 34, 0, 0, 0, 119, 0, 85, 0, 106, 76, 34, 24, 120, 76, 5, 0, 106, 76, 33, 4, 135, 31, 85, 0, 76, 0, 0, 0, 109, 34, 24, 31, 1, 76, 0, 0, 1, 77, 172, 1, 94, 77, 0, 77, 47, 76, 76, 77, 172, 209, 0, 0, 1, 31, 0, 0, 1, 76, 168, 1, 94, 76, 0, 76, 41, 77, 31, 4, 94, 76, 76, 77, 135, 36, 131, 0, 41, 39, 76, 0, 1, 76, 0, 0, 47, 76, 76, 36, 136, 209, 0, 0, 1, 76, 164, 0, 1, 77, 168, 1, 94, 77, 0, 77, 41, 74, 31, 4, 3, 77, 77, 74, 106, 77, 77, 8, 97, 34, 76, 77, 119, 0, 5, 0, 34, 77, 36, 0, 121, 77, 3, 0, 1, 2, 8, 1, 119, 0, 66, 0, 25, 31, 31, 1, 1, 77, 172, 1, 94, 77, 0, 77, 54, 77, 31, 77, 68, 209, 0, 0, 1, 77, 180, 1, 94, 77, 0, 77, 36, 77, 77, 0, 120, 77, 43, 0, 1, 31, 0, 0, 1, 36, 0, 0, 1, 77, 176, 1, 94, 77, 0, 77, 41, 76, 31, 4, 94, 77, 77, 76, 135, 32, 131, 0, 41, 39, 77, 0, 1, 77, 0, 0, 47, 77, 77, 32, 0, 210, 0, 0, 1, 77, 176, 1, 94, 77, 0, 77, 41, 76, 31, 4, 3, 77, 77, 76, 106, 55, 77, 8, 119, 0, 6, 0, 34, 77, 32, 0, 121, 77, 3, 0, 1, 2, 15, 1, 119, 0, 36, 0, 0, 55, 36, 0, 25, 31, 31, 1, 1, 77, 180, 1, 94, 77, 0, 77, 56, 77, 77, 31, 48, 210, 0, 0, 0, 36, 55, 0, 119, 0, 230, 255, 120, 55, 2, 0, 119, 0, 12, 0, 106, 36, 34, 20, 25, 76, 36, 92, 25, 74, 36, 96, 135, 77, 146, 0, 76, 74, 55, 0, 34, 77, 77, 0, 121, 77, 5, 0, 1, 2, 19, 1, 119, 0, 17, 0, 119, 0, 174, 255, 119, 0, 1, 0, 106, 77, 34, 20, 135, 79, 121, 0, 33, 77, 0, 0, 34, 79, 79, 0, 121, 79, 3, 0, 1, 2, 22, 1, 119, 0, 8, 0, 25, 40, 40, 1, 106, 79, 41, 24, 50, 79, 79, 40, 152, 210, 0, 0, 1, 2, 24, 1, 119, 0, 2, 0, 119, 0, 213, 252, 1, 79, 124, 0, 1, 78, 157, 0, 138, 2, 79, 78, 32, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 48, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 64, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 80, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 96, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 112, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 128, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 144, 213, 0, 0, 28, 213, 0, 0, 192, 213, 0, 0, 28, 213, 0, 0, 236, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 24, 214, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 40, 214, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 88, 214, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 104, 214, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 120, 214, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 92, 215, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 108, 215, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 124, 215, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 140, 215, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 156, 215, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 172, 215, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 28, 213, 0, 0, 188, 215, 0, 0, 244, 215, 0, 0, 28, 213, 0, 0, 252, 215, 0, 0, 28, 213, 0, 0, 44, 216, 0, 0, 119, 0, 198, 0, 1, 77, 1, 0, 135, 79, 13, 0, 77, 0, 0, 0, 119, 0, 194, 0, 1, 77, 1, 0, 135, 79, 13, 0, 77, 0, 0, 0, 119, 0, 190, 0, 1, 77, 1, 0, 135, 79, 13, 0, 77, 0, 0, 0, 119, 0, 186, 0, 1, 77, 1, 0, 135, 79, 13, 0, 77, 0, 0, 0, 119, 0, 182, 0, 1, 77, 1, 0, 135, 79, 13, 0, 77, 0, 0, 0, 119, 0, 178, 0, 1, 77, 1, 0, 135, 79, 13, 0, 77, 0, 0, 0, 119, 0, 174, 0, 1, 77, 1, 0, 135, 79, 13, 0, 77, 0, 0, 0, 119, 0, 170, 0, 109, 3, 88, 49, 1, 77, 0, 0, 1, 74, 16, 0, 2, 76, 0, 0, 30, 36, 10, 0, 25, 78, 3, 88, 135, 79, 5, 0, 77, 74, 76, 78, 1, 78, 1, 0, 135, 79, 13, 0, 78, 0, 0, 0, 119, 0, 158, 0, 1, 78, 0, 0, 1, 76, 16, 0, 2, 74, 0, 0, 57, 36, 10, 0, 25, 77, 3, 96, 135, 79, 5, 0, 78, 76, 74, 77, 1, 77, 1, 0, 135, 79, 13, 0, 77, 0, 0, 0, 119, 0, 147, 0, 1, 77, 0, 0, 1, 74, 16, 0, 2, 76, 0, 0, 96, 36, 10, 0, 25, 78, 3, 104, 135, 79, 5, 0, 77, 74, 76, 78, 1, 78, 1, 0, 135, 79, 13, 0, 78, 0, 0, 0, 119, 0, 136, 0, 1, 78, 1, 0, 135, 79, 13, 0, 78, 0, 0, 0, 119, 0, 132, 0, 109, 3, 112, 50, 1, 78, 0, 0, 1, 76, 16, 0, 2, 74, 0, 0, 137, 36, 10, 0, 25, 77, 3, 112, 135, 79, 5, 0, 78, 76, 74, 77, 1, 77, 1, 0, 135, 79, 13, 0, 77, 0, 0, 0, 119, 0, 120, 0, 1, 77, 1, 0, 135, 79, 13, 0, 77, 0, 0, 0, 119, 0, 116, 0, 1, 77, 1, 0, 135, 79, 13, 0, 77, 0, 0, 0, 119, 0, 112, 0, 109, 3, 120, 52, 1, 77, 0, 0, 1, 74, 8, 0, 2, 76, 0, 0, 172, 36, 10, 0, 25, 78, 3, 120, 135, 79, 5, 0, 77, 74, 76, 78, 1, 78, 0, 0, 1, 76, 8, 0, 2, 74, 0, 0, 199, 36, 10, 0, 3, 77, 3, 67, 135, 79, 5, 0, 78, 76, 74, 77, 1, 79, 0, 0, 135, 40, 147, 0, 79, 0, 0, 0, 120, 40, 12, 0, 1, 77, 0, 0, 1, 74, 8, 0, 2, 76, 0, 0, 125, 83, 13, 0, 1, 78, 144, 0, 3, 78, 3, 78, 135, 79, 5, 0, 77, 74, 76, 78, 1, 78, 1, 0, 135, 79, 13, 0, 78, 0, 0, 0, 0, 35, 40, 0, 135, 40, 148, 0, 35, 0, 0, 0, 97, 3, 68, 40, 1, 78, 0, 0, 1, 76, 8, 0, 2, 74, 0, 0, 54, 197, 10, 0, 3, 77, 3, 68, 135, 79, 5, 0, 78, 76, 74, 77, 135, 35, 147, 0, 35, 0, 0, 0, 33, 79, 35, 0, 120, 79, 243, 255, 1, 77, 0, 0, 1, 74, 8, 0, 2, 76, 0, 0, 125, 83, 13, 0, 1, 78, 144, 0, 3, 78, 3, 78, 135, 79, 5, 0, 77, 74, 76, 78, 1, 78, 1, 0, 135, 79, 13, 0, 78, 0, 0, 0, 119, 0, 55, 0, 1, 78, 1, 0, 135, 79, 13, 0, 78, 0, 0, 0, 119, 0, 51, 0, 1, 78, 1, 0, 135, 79, 13, 0, 78, 0, 0, 0, 119, 0, 47, 0, 1, 78, 1, 0, 135, 79, 13, 0, 78, 0, 0, 0, 119, 0, 43, 0, 1, 78, 1, 0, 135, 79, 13, 0, 78, 0, 0, 0, 119, 0, 39, 0, 1, 78, 1, 0, 135, 79, 13, 0, 78, 0, 0, 0, 119, 0, 35, 0, 1, 78, 1, 0, 135, 79, 13, 0, 78, 0, 0, 0, 119, 0, 31, 0, 1, 79, 160, 0, 97, 3, 79, 55, 1, 78, 0, 0, 1, 76, 8, 0, 2, 74, 0, 0, 3, 37, 10, 0, 1, 77, 160, 0, 3, 77, 3, 77, 135, 79, 5, 0, 78, 76, 74, 77, 1, 77, 1, 0, 135, 79, 13, 0, 77, 0, 0, 0, 119, 0, 17, 0, 135, 79, 62, 0, 119, 0, 15, 0, 1, 77, 0, 0, 1, 74, 16, 0, 2, 76, 0, 0, 96, 36, 10, 0, 1, 78, 168, 0, 3, 78, 3, 78, 135, 79, 5, 0, 77, 74, 76, 78, 1, 78, 1, 0, 135, 79, 13, 0, 78, 0, 0, 0, 119, 0, 3, 0, 94, 42, 3, 71, 119, 0, 1, 0, 2, 78, 0, 0, 228, 187, 65, 0, 82, 78, 78, 0, 1, 76, 0, 0, 135, 79, 149, 0, 42, 78, 6, 76, 2, 79, 0, 0, 224, 187, 65, 0, 82, 79, 79, 0, 1, 76, 4, 0, 2, 78, 0, 0, 228, 187, 65, 0, 2, 74, 0, 0, 228, 187, 65, 0, 82, 74, 74, 0, 25, 74, 74, 1, 135, 42, 136, 0, 79, 76, 78, 74, 2, 74, 0, 0, 224, 187, 65, 0, 85, 74, 42, 0, 1, 74, 104, 0, 135, 42, 93, 0, 74, 0, 0, 0, 120, 42, 4, 0, 1, 78, 1, 0, 135, 74, 13, 0, 78, 0, 0, 0, 2, 74, 0, 0, 224, 187, 65, 0, 82, 74, 74, 0, 2, 78, 0, 0, 228, 187, 65, 0, 82, 78, 78, 0, 26, 78, 78, 1, 41, 78, 78, 2, 97, 74, 78, 42, 94, 55, 3, 71, 85, 42, 55, 0, 106, 52, 55, 24, 2, 74, 0, 0, 220, 187, 65, 0, 82, 74, 74, 0, 4, 74, 74, 52, 109, 42, 12, 74, 25, 74, 0, 8, 106, 50, 74, 4, 106, 78, 0, 8, 109, 42, 64, 78, 25, 78, 42, 64, 109, 78, 4, 50, 1, 78, 192, 0, 3, 78, 0, 78, 106, 50, 78, 4, 1, 74, 192, 0, 94, 74, 0, 74, 109, 42, 80, 74, 25, 74, 42, 80, 109, 74, 4, 50, 106, 50, 0, 80, 25, 74, 0, 80, 106, 49, 74, 4, 109, 42, 40, 50, 25, 74, 42, 40, 109, 74, 4, 49, 2, 74, 0, 0, 84, 187, 65, 0, 82, 74, 74, 0, 120, 74, 4, 0, 0, 56, 37, 0, 0, 57, 38, 0, 119, 0, 25, 0, 2, 74, 0, 0, 88, 187, 65, 0, 82, 74, 74, 0, 120, 74, 4, 0, 1, 56, 0, 0, 1, 57, 0, 0, 119, 0, 18, 0, 1, 74, 40, 4, 94, 41, 55, 74, 1, 74, 40, 4, 3, 74, 55, 74, 106, 54, 74, 4, 32, 74, 41, 0, 2, 78, 0, 0, 0, 0, 0, 128, 13, 78, 54, 78, 19, 74, 74, 78, 0, 53, 74, 0, 1, 74, 0, 0, 125, 56, 53, 74, 41, 0, 0, 0, 1, 74, 0, 0, 125, 57, 53, 74, 54, 0, 0, 0, 135, 55, 20, 0, 50, 49, 56, 57, 135, 57, 2, 0, 109, 42, 48, 55, 25, 74, 42, 48, 109, 74, 4, 57, 109, 42, 88, 52, 106, 78, 0, 92, 109, 42, 96, 78, 106, 74, 0, 96, 109, 42, 100, 74, 106, 78, 0, 88, 109, 42, 16, 78, 1, 74, 0, 0, 109, 42, 24, 74, 25, 74, 42, 24, 1, 78, 0, 0, 109, 74, 4, 78, 1, 74, 1, 0, 109, 42, 32, 74, 1, 78, 1, 0, 109, 42, 36, 78, 82, 78, 0, 0, 106, 78, 78, 16, 135, 52, 150, 0, 78, 0, 0, 0, 1, 78, 228, 0, 97, 3, 78, 52, 106, 57, 42, 12, 2, 78, 0, 0, 220, 187, 65, 0, 82, 78, 78, 0, 47, 78, 57, 78, 236, 218, 0, 0, 0, 42, 57, 0, 2, 78, 0, 0, 216, 187, 65, 0, 82, 78, 78, 0, 41, 74, 42, 2, 94, 78, 78, 74, 94, 78, 78, 69, 2, 74, 0, 0, 218, 192, 65, 0, 1, 76, 0, 0, 1, 79, 2, 0, 135, 57, 6, 0, 78, 74, 76, 79, 121, 57, 22, 0, 0, 55, 57, 0, 1, 76, 228, 0, 3, 76, 3, 76, 82, 74, 55, 0, 1, 78, 0, 0, 1, 77, 0, 0, 135, 79, 4, 0, 76, 74, 78, 77, 2, 79, 0, 0, 216, 187, 65, 0, 82, 79, 79, 0, 41, 77, 42, 2, 94, 79, 79, 77, 94, 79, 79, 69, 2, 77, 0, 0, 218, 192, 65, 0, 1, 78, 2, 0, 135, 55, 6, 0, 79, 77, 55, 78, 33, 78, 55, 0, 120, 78, 237, 255, 25, 42, 42, 1, 2, 78, 0, 0, 220, 187, 65, 0, 82, 78, 78, 0, 54, 78, 42, 78, 64, 218, 0, 0, 1, 78, 228, 0, 94, 58, 3, 78, 119, 0, 2, 0, 0, 58, 52, 0, 2, 78, 0, 0, 218, 192, 65, 0, 1, 77, 0, 0, 1, 79, 2, 0, 135, 52, 6, 0, 58, 78, 77, 79, 121, 52, 95, 0, 0, 58, 52, 0, 135, 42, 135, 0, 1, 79, 240, 0, 97, 3, 79, 42, 1, 79, 240, 0, 3, 79, 3, 79, 82, 77, 58, 0, 1, 78, 0, 0, 1, 74, 0, 0, 1, 76, 3, 0, 135, 42, 127, 0, 79, 77, 78, 74, 76, 0, 0, 0, 135, 55, 151, 0, 1, 76, 236, 0, 97, 3, 76, 55, 32, 76, 42, 0, 1, 78, 236, 0, 3, 78, 3, 78, 82, 77, 58, 0, 1, 79, 0, 0, 1, 75, 0, 0, 1, 80, 3, 0, 135, 74, 127, 0, 78, 77, 79, 75, 80, 0, 0, 0, 33, 74, 74, 0, 20, 76, 76, 74, 120, 76, 35, 0, 82, 59, 58, 0, 106, 55, 42, 4, 32, 76, 55, 0, 2, 74, 0, 0, 218, 192, 65, 0, 125, 60, 76, 74, 55, 0, 0, 0, 2, 74, 0, 0, 228, 187, 65, 0, 82, 74, 74, 0, 26, 61, 74, 1, 106, 74, 42, 40, 38, 74, 74, 2, 120, 74, 2, 0, 119, 0, 29, 0, 1, 74, 192, 0, 97, 3, 74, 59, 1, 74, 192, 0, 3, 74, 3, 74, 109, 74, 4, 60, 1, 74, 192, 0, 3, 74, 3, 74, 109, 74, 8, 61, 1, 74, 192, 0, 3, 74, 3, 74, 109, 74, 12, 6, 1, 76, 0, 0, 1, 80, 24, 0, 2, 75, 0, 0, 113, 37, 10, 0, 1, 79, 192, 0, 3, 79, 3, 79, 135, 74, 5, 0, 76, 80, 75, 79, 1, 74, 228, 0, 94, 74, 3, 74, 2, 79, 0, 0, 218, 192, 65, 0, 1, 75, 2, 0, 135, 58, 6, 0, 74, 79, 58, 75, 120, 58, 187, 255, 119, 0, 23, 0, 1, 75, 176, 0, 97, 3, 75, 59, 1, 75, 176, 0, 3, 75, 3, 75, 109, 75, 4, 60, 1, 75, 176, 0, 3, 75, 3, 75, 109, 75, 8, 61, 1, 75, 176, 0, 3, 75, 3, 75, 109, 75, 12, 6, 1, 79, 0, 0, 1, 74, 16, 0, 2, 80, 0, 0, 29, 37, 10, 0, 1, 76, 176, 0, 3, 76, 3, 76, 135, 75, 5, 0, 79, 74, 80, 76, 1, 76, 1, 0, 135, 75, 13, 0, 76, 0, 0, 0, 1, 76, 228, 0, 3, 76, 3, 76, 135, 75, 79, 0, 76, 0, 0, 0, 106, 6, 0, 116, 36, 75, 6, 0, 121, 75, 8, 0, 2, 75, 0, 0, 160, 187, 65, 0, 1, 76, 1, 0, 85, 75, 76, 0, 137, 3, 0, 0, 1, 76, 0, 0, 139, 76, 0, 0, 1, 61, 0, 0, 94, 60, 3, 71, 0, 59, 6, 0, 106, 76, 60, 24, 120, 76, 4, 0, 0, 62, 59, 0, 0, 63, 60, 0, 119, 0, 101, 0, 1, 6, 0, 0, 0, 52, 60, 0, 106, 76, 52, 28, 41, 75, 6, 2, 94, 64, 76, 75, 106, 75, 0, 112, 41, 80, 61, 4, 94, 75, 75, 80, 135, 76, 131, 0, 52, 64, 75, 0, 32, 76, 76, 1, 121, 76, 82, 0, 106, 76, 0, 112, 41, 75, 61, 4, 3, 76, 76, 75, 106, 58, 76, 8, 1, 76, 240, 0, 1, 75, 0, 0, 97, 3, 76, 75, 1, 75, 176, 0, 94, 75, 64, 75, 106, 75, 75, 16, 120, 75, 20, 0, 82, 42, 64, 0, 1, 75, 208, 0, 2, 76, 0, 0, 228, 187, 65, 0, 82, 76, 76, 0, 26, 76, 76, 1, 97, 3, 75, 76, 1, 76, 208, 0, 3, 76, 3, 76, 109, 76, 4, 42, 1, 75, 0, 0, 1, 80, 24, 0, 2, 74, 0, 0, 128, 38, 10, 0, 1, 79, 208, 0, 3, 79, 3, 79, 135, 76, 5, 0, 75, 80, 74, 79, 119, 0, 52, 0, 78, 76, 58, 0, 120, 76, 18, 0, 106, 76, 64, 64, 2, 79, 0, 0, 90, 136, 11, 0, 1, 74, 0, 0, 1, 80, 0, 0, 135, 42, 6, 0, 76, 79, 74, 80, 120, 42, 3, 0, 0, 65, 58, 0, 119, 0, 2, 0, 106, 65, 42, 4, 78, 80, 65, 0, 120, 80, 3, 0, 1, 2, 56, 1, 119, 0, 50, 0, 0, 66, 65, 0, 119, 0, 2, 0, 0, 66, 58, 0, 135, 80, 152, 0, 66, 0, 0, 0, 1, 74, 240, 0, 3, 74, 3, 74, 1, 79, 2, 0, 2, 76, 0, 0, 244, 117, 9, 0, 1, 75, 0, 0, 135, 80, 153, 0, 74, 66, 79, 76, 75, 0, 0, 0, 34, 80, 80, 0, 121, 80, 3, 0, 1, 2, 58, 1, 119, 0, 32, 0, 1, 80, 176, 0, 94, 58, 64, 80, 1, 75, 240, 0, 94, 75, 3, 75, 106, 76, 58, 12, 106, 79, 58, 16, 135, 80, 154, 0, 75, 76, 79, 0, 1, 79, 240, 0, 94, 79, 3, 79, 135, 80, 155, 0, 79, 0, 0, 0, 1, 79, 240, 0, 94, 79, 3, 79, 135, 80, 156, 0, 79, 0, 0, 0, 25, 6, 6, 1, 94, 52, 3, 71, 106, 80, 52, 24, 55, 80, 6, 80, 228, 220, 0, 0, 106, 62, 0, 116, 0, 63, 52, 0, 25, 61, 61, 1, 49, 80, 62, 61, 128, 222, 0, 0, 1, 2, 64, 1, 119, 0, 4, 0, 0, 60, 63, 0, 0, 59, 62, 0, 119, 0, 144, 255, 1, 80, 56, 1, 45, 80, 2, 80, 240, 222, 0, 0, 82, 62, 64, 0, 1, 80, 216, 0, 2, 79, 0, 0, 228, 187, 65, 0, 82, 79, 79, 0, 26, 79, 79, 1, 97, 3, 80, 79, 1, 79, 216, 0, 3, 79, 3, 79, 109, 79, 4, 62, 1, 80, 0, 0, 1, 76, 8, 0, 2, 75, 0, 0, 168, 38, 10, 0, 1, 74, 216, 0, 3, 74, 3, 74, 135, 79, 5, 0, 80, 76, 75, 74, 1, 74, 1, 0, 135, 79, 13, 0, 74, 0, 0, 0, 119, 0, 28, 0, 1, 79, 58, 1, 45, 79, 2, 79, 52, 223, 0, 0, 1, 79, 224, 0, 97, 3, 79, 66, 1, 74, 0, 0, 1, 75, 8, 0, 2, 76, 0, 0, 230, 38, 10, 0, 1, 80, 224, 0, 3, 80, 3, 80, 135, 79, 5, 0, 74, 75, 76, 80, 1, 80, 1, 0, 135, 79, 13, 0, 80, 0, 0, 0, 119, 0, 11, 0, 1, 79, 64, 1, 45, 79, 2, 79, 92, 223, 0, 0, 2, 79, 0, 0, 160, 187, 65, 0, 1, 80, 1, 0, 85, 79, 80, 0, 137, 3, 0, 0, 1, 80, 0, 0, 139, 80, 0, 0, 1, 80, 0, 0, 139, 80, 0, 0, 140, 7, 88, 0, 0, 0, 0, 0, 2, 72, 0, 0, 84, 1, 0, 0, 2, 73, 0, 0, 255, 0, 0, 0, 2, 74, 0, 0, 88, 1, 0, 0, 2, 75, 0, 0, 102, 1, 0, 0, 2, 76, 0, 0, 0, 1, 0, 0, 2, 77, 0, 0, 76, 1, 0, 0, 2, 78, 0, 0, 80, 1, 0, 0, 2, 79, 0, 0, 240, 0, 0, 0, 1, 7, 0, 0, 136, 80, 0, 0, 0, 8, 80, 0, 136, 80, 0, 0, 1, 81, 112, 1, 3, 80, 80, 81, 137, 80, 0, 0, 33, 80, 5, 0, 33, 81, 6, 0, 20, 80, 80, 81, 34, 81, 6, 0, 32, 82, 6, 0, 35, 83, 5, 10, 19, 82, 82, 83, 20, 81, 81, 82, 19, 80, 80, 81, 121, 80, 3, 0, 137, 8, 0, 0, 139, 0, 0, 0, 1, 80, 0, 0, 1, 81, 0, 0, 1, 82, 1, 0, 135, 9, 33, 0, 0, 80, 81, 82, 135, 10, 2, 0, 1, 82, 246, 255, 1, 81, 255, 255, 135, 11, 44, 0, 5, 6, 82, 81, 135, 12, 2, 0, 1, 81, 0, 0, 1, 82, 0, 0, 1, 80, 1, 0, 135, 13, 33, 0, 0, 81, 82, 80, 135, 14, 2, 0, 135, 15, 20, 0, 13, 14, 9, 10, 135, 16, 2, 0, 15, 80, 16, 12, 13, 82, 16, 12, 16, 81, 15, 11, 19, 82, 82, 81, 20, 80, 80, 82, 33, 82, 5, 0, 33, 81, 6, 0, 20, 82, 82, 81, 40, 82, 82, 1, 20, 80, 80, 82, 121, 80, 39, 4, 0, 17, 13, 0, 0, 18, 14, 0, 1, 82, 10, 0, 1, 81, 0, 0, 135, 80, 157, 0, 0, 82, 81, 0, 36, 80, 80, 255, 121, 80, 3, 0, 1, 7, 7, 0, 119, 0, 15, 4, 1, 81, 92, 1, 3, 81, 8, 81, 1, 82, 10, 0, 134, 80, 0, 0, 112, 52, 1, 0, 0, 81, 82, 0, 33, 80, 80, 10, 121, 80, 3, 0, 1, 7, 7, 0, 119, 0, 5, 4, 1, 80, 92, 1, 91, 80, 8, 80, 78, 82, 3, 0, 46, 80, 80, 82, 224, 224, 0, 0, 1, 7, 109, 0, 119, 0, 254, 3, 1, 80, 92, 1, 3, 80, 8, 80, 103, 80, 80, 1, 102, 82, 3, 1, 46, 80, 80, 82, 0, 225, 0, 0, 1, 7, 109, 0, 119, 0, 246, 3, 1, 80, 92, 1, 3, 80, 8, 80, 102, 19, 80, 3, 1, 80, 92, 1, 3, 80, 8, 80, 102, 20, 80, 6, 1, 80, 92, 1, 3, 80, 8, 80, 102, 21, 80, 7, 1, 80, 92, 1, 3, 80, 8, 80, 102, 22, 80, 8, 1, 80, 255, 255, 20, 82, 20, 21, 20, 82, 82, 22, 41, 82, 82, 24, 42, 82, 82, 24, 15, 80, 80, 82, 1, 81, 92, 1, 3, 81, 8, 81, 102, 81, 81, 4, 32, 81, 81, 255, 121, 81, 4, 0, 1, 81, 1, 0, 0, 82, 81, 0, 119, 0, 15, 0, 41, 83, 19, 24, 42, 83, 83, 24, 32, 83, 83, 255, 121, 83, 4, 0, 1, 83, 1, 0, 0, 81, 83, 0, 119, 0, 7, 0, 1, 83, 92, 1, 3, 83, 8, 83, 103, 83, 83, 2, 102, 84, 3, 2, 14, 83, 83, 84, 0, 81, 83, 0, 0, 82, 81, 0, 40, 82, 82, 1, 19, 80, 80, 82, 120, 80, 3, 0, 1, 7, 109, 0, 119, 0, 201, 3, 1, 80, 92, 1, 3, 80, 8, 80, 102, 23, 80, 9, 41, 80, 23, 24, 42, 80, 80, 24, 36, 80, 80, 255, 121, 80, 3, 0, 1, 7, 109, 0, 119, 0, 192, 3, 1, 80, 92, 1, 3, 80, 8, 80, 102, 24, 80, 5, 1, 80, 0, 0, 1, 82, 0, 0, 1, 81, 1, 0, 135, 25, 33, 0, 0, 80, 82, 81, 38, 81, 21, 127, 41, 81, 81, 14, 38, 82, 20, 127, 41, 82, 82, 21, 20, 81, 81, 82, 38, 82, 22, 127, 41, 82, 82, 7, 20, 81, 81, 82, 38, 82, 23, 127, 20, 81, 81, 82, 0, 26, 81, 0, 135, 81, 2, 0, 1, 82, 0, 0, 135, 27, 44, 0, 25, 81, 26, 82, 135, 25, 2, 0, 1, 81, 0, 0, 97, 8, 77, 81, 1, 81, 72, 1, 1, 82, 0, 0, 97, 8, 81, 82, 1, 82, 208, 0, 19, 81, 19, 73, 97, 8, 82, 81, 1, 81, 208, 0, 3, 81, 8, 81, 19, 82, 24, 73, 109, 81, 4, 82, 1, 82, 208, 0, 3, 82, 8, 82, 109, 82, 8, 26, 1, 81, 48, 0, 2, 80, 0, 0, 234, 216, 10, 0, 1, 83, 208, 0, 3, 83, 8, 83, 135, 82, 5, 0, 2, 81, 80, 83, 41, 82, 19, 24, 42, 82, 82, 24, 1, 83, 2, 0, 1, 80, 3, 0, 138, 82, 83, 80, 192, 226, 0, 0, 44, 227, 0, 0, 172, 228, 0, 0, 2, 34, 0, 0, 55, 218, 10, 0, 1, 7, 108, 0, 119, 0, 125, 0, 38, 83, 24, 64, 120, 83, 22, 0, 1, 28, 0, 0, 2, 29, 0, 0, 15, 217, 10, 0, 1, 30, 6, 0, 38, 83, 21, 127, 41, 83, 83, 14, 38, 80, 20, 127, 41, 80, 80, 21, 20, 83, 83, 80, 38, 80, 22, 127, 41, 80, 80, 7, 20, 83, 83, 80, 38, 80, 23, 127, 20, 83, 83, 80, 0, 31, 83, 0, 1, 83, 128, 0, 19, 83, 24, 83, 0, 32, 83, 0, 1, 33, 0, 0, 1, 7, 18, 0, 119, 0, 102, 0, 2, 34, 0, 0, 43, 218, 10, 0, 1, 7, 108, 0, 119, 0, 98, 0, 38, 83, 24, 64, 120, 83, 22, 0, 1, 28, 1, 0, 2, 29, 0, 0, 10, 217, 10, 0, 1, 30, 10, 0, 38, 83, 21, 127, 41, 83, 83, 14, 38, 80, 20, 127, 41, 80, 80, 21, 20, 83, 83, 80, 38, 80, 22, 127, 41, 80, 80, 7, 20, 83, 83, 80, 38, 80, 23, 127, 20, 83, 83, 80, 0, 31, 83, 0, 1, 83, 128, 0, 19, 83, 24, 83, 0, 32, 83, 0, 1, 33, 1, 0, 1, 7, 18, 0, 119, 0, 75, 0, 135, 83, 158, 0, 0, 0, 0, 0, 41, 83, 83, 7, 1, 80, 128, 63, 19, 83, 83, 80, 0, 26, 83, 0, 135, 83, 158, 0, 0, 0, 0, 0, 38, 83, 83, 127, 20, 83, 83, 26, 41, 83, 83, 7, 0, 35, 83, 0, 135, 83, 158, 0, 0, 0, 0, 0, 38, 83, 83, 127, 20, 83, 35, 83, 41, 83, 83, 7, 0, 26, 83, 0, 135, 83, 158, 0, 0, 0, 0, 0, 38, 83, 83, 127, 20, 83, 26, 83, 0, 35, 83, 0, 41, 80, 19, 24, 42, 80, 80, 24, 32, 80, 80, 4, 121, 80, 4, 0, 26, 80, 35, 4, 0, 83, 80, 0, 119, 0, 2, 0, 0, 83, 35, 0, 0, 26, 83, 0, 38, 83, 21, 127, 41, 83, 83, 14, 38, 80, 20, 127, 41, 80, 80, 21, 20, 83, 83, 80, 38, 80, 22, 127, 41, 80, 80, 7, 20, 83, 83, 80, 38, 80, 23, 127, 20, 83, 83, 80, 26, 83, 83, 4, 4, 35, 83, 26, 34, 83, 26, 0, 121, 83, 5, 0, 2, 34, 0, 0, 63, 218, 10, 0, 1, 7, 108, 0, 119, 0, 25, 0, 34, 80, 26, 0, 41, 80, 80, 31, 42, 80, 80, 31, 135, 83, 159, 0, 0, 26, 80, 0, 135, 83, 2, 0, 34, 83, 35, 0, 121, 83, 5, 0, 2, 34, 0, 0, 94, 218, 10, 0, 1, 7, 108, 0, 119, 0, 13, 0, 1, 28, 1, 0, 2, 29, 0, 0, 10, 217, 10, 0, 1, 30, 10, 0, 0, 31, 35, 0, 1, 83, 128, 0, 19, 83, 24, 83, 0, 32, 83, 0, 1, 33, 1, 0, 1, 7, 18, 0, 119, 0, 2, 0, 119, 0, 160, 255, 32, 82, 7, 18, 121, 82, 209, 2, 1, 7, 0, 0, 49, 82, 30, 31, 180, 239, 0, 0, 1, 35, 0, 0, 0, 26, 31, 0, 121, 33, 251, 0, 3, 83, 8, 75, 1, 80, 4, 0, 134, 82, 0, 0, 112, 52, 1, 0, 0, 83, 80, 0, 34, 82, 82, 4, 120, 82, 179, 2, 3, 82, 8, 75, 1, 80, 0, 0, 107, 82, 4, 80, 135, 23, 160, 0, 0, 0, 0, 0, 41, 80, 19, 24, 42, 80, 80, 24, 33, 80, 80, 3, 1, 82, 127, 0, 16, 82, 82, 23, 19, 80, 80, 82, 121, 80, 224, 0, 50, 80, 26, 23, 104, 229, 0, 0, 43, 80, 23, 1, 1, 82, 128, 63, 19, 80, 80, 82, 38, 82, 23, 127, 20, 80, 80, 82, 43, 82, 23, 2, 2, 83, 0, 0, 0, 192, 31, 0, 19, 82, 82, 83, 20, 80, 80, 82, 43, 82, 23, 3, 2, 83, 0, 0, 0, 0, 224, 15, 19, 82, 82, 83, 20, 80, 80, 82, 0, 36, 80, 0, 119, 0, 206, 0, 1, 80, 0, 0, 1, 82, 0, 0, 1, 83, 1, 0, 135, 22, 33, 0, 0, 80, 82, 83, 135, 20, 2, 0, 25, 82, 23, 6, 1, 80, 0, 0, 135, 83, 157, 0, 0, 82, 80, 0, 120, 83, 137, 2, 25, 83, 22, 2, 43, 80, 23, 1, 1, 82, 128, 63, 19, 80, 80, 82, 38, 82, 23, 127, 20, 80, 80, 82, 43, 82, 23, 2, 2, 81, 0, 0, 0, 192, 31, 0, 19, 82, 82, 81, 20, 80, 80, 82, 43, 82, 23, 3, 2, 81, 0, 0, 0, 0, 224, 15, 19, 82, 82, 81, 20, 80, 80, 82, 3, 21, 83, 80, 34, 83, 21, 0, 41, 83, 83, 31, 42, 83, 83, 31, 1, 82, 0, 0, 135, 80, 33, 0, 0, 21, 83, 82, 135, 80, 2, 0, 34, 80, 80, 0, 121, 80, 3, 0, 1, 7, 33, 0, 119, 0, 80, 0, 1, 82, 4, 0, 134, 80, 0, 0, 112, 52, 1, 0, 0, 8, 82, 0, 34, 80, 80, 4, 121, 80, 3, 0, 1, 7, 33, 0, 119, 0, 72, 0, 82, 21, 8, 0, 121, 21, 54, 0, 102, 37, 8, 3, 1, 80, 25, 0, 26, 82, 37, 65, 19, 82, 82, 73, 15, 80, 80, 82, 1, 82, 9, 0, 26, 83, 37, 48, 19, 83, 83, 73, 15, 82, 82, 83, 19, 80, 80, 82, 121, 80, 3, 0, 1, 7, 33, 0, 119, 0, 57, 0, 102, 37, 8, 2, 1, 80, 25, 0, 26, 82, 37, 65, 19, 82, 82, 73, 15, 80, 80, 82, 1, 82, 9, 0, 26, 83, 37, 48, 19, 83, 83, 73, 15, 82, 82, 83, 19, 80, 80, 82, 121, 80, 3, 0, 1, 7, 33, 0, 119, 0, 44, 0, 102, 37, 8, 1, 1, 80, 25, 0, 26, 82, 37, 65, 19, 82, 82, 73, 15, 80, 80, 82, 1, 82, 9, 0, 26, 83, 37, 48, 19, 83, 83, 73, 15, 82, 82, 83, 19, 80, 80, 82, 121, 80, 3, 0, 1, 7, 33, 0, 119, 0, 31, 0, 1, 80, 25, 0, 19, 82, 21, 73, 26, 82, 82, 65, 19, 82, 82, 73, 15, 80, 80, 82, 1, 82, 9, 0, 19, 83, 21, 73, 26, 83, 83, 48, 19, 83, 83, 73, 15, 82, 82, 83, 19, 80, 80, 82, 121, 80, 3, 0, 1, 7, 33, 0, 119, 0, 17, 0, 43, 80, 23, 1, 1, 82, 128, 63, 19, 80, 80, 82, 38, 82, 23, 127, 20, 80, 80, 82, 43, 82, 23, 2, 2, 83, 0, 0, 0, 192, 31, 0, 19, 82, 82, 83, 20, 80, 80, 82, 43, 82, 23, 3, 2, 83, 0, 0, 0, 0, 224, 15, 19, 82, 82, 83, 20, 80, 80, 82, 0, 38, 80, 0, 32, 80, 7, 33, 121, 80, 79, 0, 1, 7, 0, 0, 25, 80, 22, 2, 3, 21, 80, 23, 34, 82, 21, 0, 41, 82, 82, 31, 42, 82, 82, 31, 1, 83, 0, 0, 135, 80, 33, 0, 0, 21, 82, 83, 135, 80, 2, 0, 34, 80, 80, 0, 121, 80, 3, 0, 1, 7, 40, 0, 119, 0, 252, 1, 1, 83, 4, 0, 134, 80, 0, 0, 112, 52, 1, 0, 0, 8, 83, 0, 34, 80, 80, 4, 121, 80, 3, 0, 1, 7, 40, 0, 119, 0, 244, 1, 82, 21, 8, 0, 121, 21, 54, 0, 102, 37, 8, 3, 1, 80, 25, 0, 26, 83, 37, 65, 19, 83, 83, 73, 15, 80, 80, 83, 1, 83, 9, 0, 26, 82, 37, 48, 19, 82, 82, 73, 15, 83, 83, 82, 19, 80, 80, 83, 121, 80, 3, 0, 1, 7, 40, 0, 119, 0, 229, 1, 102, 37, 8, 2, 1, 80, 25, 0, 26, 83, 37, 65, 19, 83, 83, 73, 15, 80, 80, 83, 1, 83, 9, 0, 26, 82, 37, 48, 19, 82, 82, 73, 15, 83, 83, 82, 19, 80, 80, 83, 121, 80, 3, 0, 1, 7, 40, 0, 119, 0, 216, 1, 102, 37, 8, 1, 1, 80, 25, 0, 26, 83, 37, 65, 19, 83, 83, 73, 15, 80, 80, 83, 1, 83, 9, 0, 26, 82, 37, 48, 19, 82, 82, 73, 15, 83, 83, 82, 19, 80, 80, 83, 121, 80, 3, 0, 1, 7, 40, 0, 119, 0, 203, 1, 1, 80, 25, 0, 19, 83, 21, 73, 26, 83, 83, 65, 19, 83, 83, 73, 15, 80, 80, 83, 1, 83, 9, 0, 19, 82, 21, 73, 26, 82, 82, 48, 19, 82, 82, 73, 15, 83, 83, 82, 19, 80, 80, 83, 121, 80, 3, 0, 1, 7, 40, 0, 119, 0, 189, 1, 0, 38, 23, 0, 1, 83, 0, 0, 135, 80, 33, 0, 0, 22, 20, 83, 135, 80, 2, 0, 0, 36, 38, 0, 119, 0, 2, 0, 0, 36, 23, 0, 135, 23, 161, 0, 0, 0, 0, 0, 38, 80, 23, 2, 0, 39, 80, 0, 0, 40, 23, 0, 0, 41, 36, 0, 119, 0, 15, 0, 3, 83, 8, 75, 1, 82, 3, 0, 134, 80, 0, 0, 112, 52, 1, 0, 0, 83, 82, 0, 34, 80, 80, 3, 120, 80, 185, 1, 3, 80, 8, 75, 1, 82, 0, 0, 107, 80, 3, 82, 1, 39, 0, 0, 1, 40, 0, 0, 135, 41, 162, 0, 0, 0, 0, 0, 2, 82, 0, 0, 0, 0, 0, 16, 55, 82, 82, 41, 180, 239, 0, 0, 4, 82, 26, 30, 4, 26, 82, 41, 34, 82, 26, 0, 120, 82, 170, 1, 1, 82, 0, 0, 1, 80, 0, 0, 1, 83, 1, 0, 135, 23, 33, 0, 0, 82, 80, 83, 135, 83, 2, 0, 1, 80, 0, 0, 135, 21, 44, 0, 23, 83, 41, 80, 135, 23, 2, 0, 120, 41, 17, 0, 90, 80, 8, 75, 120, 80, 3, 0, 0, 42, 35, 0, 119, 0, 133, 1, 1, 80, 224, 0, 3, 83, 8, 75, 97, 8, 80, 83, 1, 80, 48, 0, 2, 82, 0, 0, 19, 217, 10, 0, 1, 81, 224, 0, 3, 81, 8, 81, 135, 83, 5, 0, 2, 80, 82, 81, 0, 42, 35, 0, 119, 0, 121, 1, 38, 83, 40, 1, 120, 83, 3, 0, 0, 43, 41, 0, 119, 0, 6, 0, 35, 83, 41, 4, 120, 83, 137, 1, 135, 83, 160, 0, 0, 0, 0, 0, 26, 43, 41, 4, 38, 83, 40, 8, 0, 37, 83, 0, 38, 83, 40, 12, 120, 83, 70, 1, 90, 44, 8, 75, 41, 83, 44, 24, 42, 83, 83, 24, 32, 83, 83, 84, 121, 83, 3, 0, 0, 45, 35, 0, 119, 0, 33, 0, 3, 81, 8, 75, 2, 82, 0, 0, 38, 215, 10, 0, 1, 80, 4, 0, 135, 83, 163, 0, 81, 82, 80, 0, 120, 83, 3, 0, 0, 45, 35, 0, 119, 0, 24, 0, 3, 80, 8, 75, 135, 83, 19, 0, 80, 29, 0, 0, 120, 83, 3, 0, 0, 45, 35, 0, 119, 0, 18, 0, 120, 4, 3, 0, 0, 46, 35, 0, 119, 0, 9, 0, 3, 83, 8, 75, 135, 47, 164, 0, 83, 28, 0, 0, 120, 47, 3, 0, 1, 46, 0, 0, 119, 0, 3, 0, 0, 45, 47, 0, 119, 0, 7, 0, 41, 83, 44, 24, 42, 83, 83, 24, 120, 83, 2, 0, 119, 0, 75, 1, 0, 48, 46, 0, 119, 0, 64, 1, 20, 83, 39, 32, 0, 44, 83, 0, 20, 83, 44, 37, 121, 83, 17, 0, 3, 80, 8, 77, 1, 82, 72, 1, 3, 82, 8, 82, 135, 83, 165, 0, 80, 82, 43, 0, 94, 83, 8, 77, 120, 83, 10, 0, 97, 8, 79, 43, 1, 82, 16, 0, 2, 80, 0, 0, 129, 217, 10, 0, 3, 81, 8, 79, 135, 83, 5, 0, 2, 82, 80, 81, 0, 48, 45, 0, 119, 0, 44, 1, 120, 44, 4, 0, 0, 49, 0, 0, 0, 50, 43, 0, 119, 0, 65, 0, 94, 20, 8, 77, 3, 22, 20, 43, 134, 83, 0, 0, 112, 52, 1, 0, 0, 20, 43, 0, 46, 83, 83, 43, 236, 234, 0, 0, 1, 81, 16, 0, 2, 80, 0, 0, 155, 217, 10, 0, 1, 82, 248, 0, 3, 82, 8, 82, 135, 83, 5, 0, 2, 81, 80, 82, 0, 48, 45, 0, 119, 0, 24, 1, 120, 43, 3, 0, 0, 51, 20, 0, 119, 0, 31, 0, 0, 47, 20, 0, 0, 52, 20, 0, 25, 53, 47, 1, 25, 54, 52, 1, 78, 83, 47, 0, 83, 52, 83, 0, 45, 83, 53, 22, 32, 235, 0, 0, 0, 51, 54, 0, 119, 0, 21, 0, 78, 83, 47, 0, 32, 83, 83, 255, 121, 83, 10, 0, 78, 82, 53, 0, 32, 82, 82, 0, 121, 82, 4, 0, 25, 82, 47, 2, 0, 83, 82, 0, 119, 0, 2, 0, 0, 83, 53, 0, 0, 55, 83, 0, 119, 0, 2, 0, 0, 55, 53, 0, 45, 83, 55, 22, 100, 235, 0, 0, 0, 51, 54, 0, 119, 0, 4, 0, 0, 47, 55, 0, 0, 52, 54, 0, 119, 0, 229, 255, 94, 22, 8, 77, 0, 20, 51, 0, 25, 82, 8, 24, 4, 80, 20, 22, 1, 81, 0, 0, 1, 84, 0, 0, 1, 85, 0, 0, 1, 86, 0, 0, 1, 87, 0, 0, 135, 83, 166, 0, 82, 22, 80, 81, 84, 85, 86, 87, 25, 49, 8, 24, 94, 83, 8, 77, 4, 50, 20, 83, 90, 83, 8, 75, 32, 83, 83, 84, 121, 83, 7, 0, 3, 87, 8, 75, 135, 83, 167, 0, 2, 49, 50, 1, 87, 0, 0, 0, 0, 48, 45, 0, 119, 0, 223, 0, 3, 87, 8, 75, 2, 86, 0, 0, 38, 215, 10, 0, 1, 85, 4, 0, 135, 83, 163, 0, 87, 86, 85, 0, 120, 83, 97, 0, 85, 8, 50, 0, 1, 85, 0, 0, 97, 8, 72, 85, 1, 83, 0, 0, 97, 8, 78, 83, 34, 83, 50, 1, 121, 83, 3, 0, 1, 7, 84, 0, 119, 0, 67, 0, 135, 20, 158, 0, 49, 0, 0, 0, 26, 83, 50, 1, 85, 8, 83, 0, 3, 85, 8, 74, 1, 86, 3, 0, 134, 83, 0, 0, 112, 52, 1, 0, 49, 85, 86, 0, 34, 83, 83, 3, 121, 83, 3, 0, 1, 7, 84, 0, 119, 0, 54, 0, 3, 83, 8, 74, 1, 86, 0, 0, 107, 83, 3, 86, 26, 86, 50, 4, 85, 8, 86, 0, 3, 83, 8, 72, 135, 86, 168, 0, 2, 49, 20, 83, 8, 0, 0, 0, 34, 86, 86, 0, 121, 86, 3, 0, 1, 7, 84, 0, 119, 0, 41, 0, 3, 83, 8, 78, 135, 86, 168, 0, 2, 49, 20, 83, 8, 0, 0, 0, 34, 86, 86, 0, 121, 86, 3, 0, 1, 7, 84, 0, 119, 0, 33, 0, 94, 20, 8, 72, 78, 86, 20, 0, 33, 22, 86, 0, 2, 85, 0, 0, 218, 192, 65, 0, 125, 83, 22, 20, 85, 0, 0, 0, 97, 8, 76, 83, 3, 83, 8, 76, 2, 85, 0, 0, 20, 47, 13, 0, 2, 87, 0, 0, 218, 192, 65, 0, 125, 86, 22, 85, 87, 0, 0, 0, 109, 83, 4, 86, 3, 86, 8, 76, 3, 83, 8, 74, 109, 86, 8, 83, 2, 83, 0, 0, 180, 217, 10, 0, 3, 86, 8, 76, 135, 22, 169, 0, 83, 86, 0, 0, 120, 22, 3, 0, 1, 7, 84, 0, 119, 0, 6, 0, 94, 83, 8, 78, 1, 87, 0, 0, 135, 86, 4, 0, 1, 22, 83, 87, 0, 56, 22, 0, 32, 86, 7, 84, 121, 86, 10, 0, 1, 7, 0, 0, 1, 87, 16, 0, 2, 83, 0, 0, 194, 217, 10, 0, 1, 85, 16, 1, 3, 85, 8, 85, 135, 86, 5, 0, 2, 87, 83, 85, 1, 56, 0, 0, 94, 85, 8, 72, 135, 86, 170, 0, 85, 0, 0, 0, 94, 85, 8, 78, 135, 86, 170, 0, 85, 0, 0, 0, 135, 86, 170, 0, 56, 0, 0, 0, 0, 48, 45, 0, 119, 0, 120, 0, 3, 85, 8, 75, 135, 86, 19, 0, 85, 29, 0, 0, 121, 86, 9, 0, 106, 85, 45, 8, 19, 85, 85, 73, 3, 83, 8, 75, 135, 86, 171, 0, 85, 2, 49, 50, 83, 4, 28, 0, 0, 48, 45, 0, 119, 0, 108, 0, 85, 8, 50, 0, 2, 85, 0, 0, 131, 148, 11, 0, 97, 8, 74, 85, 1, 85, 4, 0, 49, 85, 85, 50, 188, 238, 0, 0, 135, 22, 158, 0, 49, 0, 0, 0, 135, 85, 172, 0, 49, 0, 0, 0, 26, 85, 50, 4, 85, 8, 85, 0, 3, 86, 8, 72, 135, 85, 168, 0, 2, 49, 22, 86, 8, 0, 0, 0, 34, 85, 85, 0, 121, 85, 9, 0, 1, 86, 16, 0, 2, 83, 0, 0, 225, 217, 10, 0, 1, 87, 24, 1, 3, 87, 8, 87, 135, 85, 5, 0, 2, 86, 83, 87, 119, 0, 46, 0, 94, 20, 8, 72, 120, 20, 3, 0, 1, 57, 24, 0, 119, 0, 15, 0, 78, 85, 20, 0, 120, 85, 10, 0, 3, 87, 8, 72, 135, 85, 73, 0, 87, 0, 0, 0, 94, 44, 8, 72, 120, 44, 3, 0, 1, 57, 24, 0, 119, 0, 6, 0, 0, 58, 44, 0, 119, 0, 2, 0, 0, 58, 20, 0, 97, 8, 74, 58, 1, 57, 28, 0, 3, 87, 8, 72, 135, 85, 168, 0, 2, 49, 22, 87, 8, 0, 0, 0, 34, 85, 85, 0, 121, 85, 15, 0, 1, 87, 16, 0, 2, 83, 0, 0, 225, 217, 10, 0, 1, 86, 32, 1, 3, 86, 8, 86, 135, 85, 5, 0, 2, 87, 83, 86, 38, 85, 57, 4, 120, 85, 2, 0, 119, 0, 12, 0, 3, 86, 8, 74, 135, 85, 73, 0, 86, 0, 0, 0, 119, 0, 8, 0, 94, 20, 8, 72, 120, 20, 2, 0, 119, 0, 5, 0, 94, 86, 8, 74, 135, 85, 4, 0, 1, 86, 20, 57, 119, 0, 1, 0, 0, 48, 45, 0, 119, 0, 34, 0, 1, 85, 232, 0, 32, 83, 37, 0, 121, 83, 5, 0, 2, 83, 0, 0, 90, 217, 10, 0, 0, 86, 83, 0, 119, 0, 10, 0, 38, 87, 40, 4, 32, 87, 87, 0, 2, 84, 0, 0, 54, 217, 10, 0, 2, 81, 0, 0, 65, 217, 10, 0, 125, 83, 87, 84, 81, 0, 0, 0, 0, 86, 83, 0, 97, 8, 85, 86, 1, 86, 232, 0, 3, 86, 8, 86, 3, 85, 8, 75, 109, 86, 4, 85, 1, 86, 24, 0, 2, 83, 0, 0, 100, 217, 10, 0, 1, 81, 232, 0, 3, 81, 8, 81, 135, 85, 5, 0, 2, 86, 83, 81, 1, 81, 0, 0, 135, 85, 159, 0, 0, 43, 81, 0, 135, 85, 2, 0, 0, 48, 35, 0, 1, 81, 0, 0, 135, 85, 33, 0, 0, 21, 23, 81, 135, 85, 2, 0, 0, 42, 48, 0, 54, 85, 26, 30, 180, 239, 0, 0, 0, 35, 42, 0, 119, 0, 89, 253, 32, 85, 7, 40, 121, 85, 3, 0, 1, 7, 0, 0, 119, 0, 15, 0, 3, 85, 8, 75, 102, 85, 85, 1, 121, 85, 8, 0, 1, 81, 24, 0, 2, 83, 0, 0, 7, 218, 10, 0, 1, 86, 40, 1, 3, 86, 8, 86, 135, 85, 5, 0, 2, 81, 83, 86, 1, 86, 0, 0, 135, 85, 159, 0, 0, 43, 86, 0, 135, 85, 2, 0, 1, 85, 10, 0, 1, 86, 0, 0, 135, 35, 44, 0, 27, 25, 85, 86, 135, 26, 2, 0, 41, 86, 19, 24, 42, 86, 86, 24, 33, 86, 86, 4, 38, 85, 24, 16, 32, 85, 85, 0, 20, 86, 86, 85, 0, 37, 86, 0, 125, 59, 37, 27, 35, 0, 0, 0, 125, 60, 37, 25, 26, 0, 0, 0, 119, 0, 19, 0, 32, 86, 7, 108, 121, 86, 17, 0], eb + 51200);
                HEAPU8.set([1, 7, 0, 0, 1, 86, 48, 1, 19, 85, 19, 73, 97, 8, 86, 85, 1, 85, 48, 1, 3, 85, 8, 85, 109, 85, 4, 34, 1, 86, 32, 0, 2, 83, 0, 0, 120, 218, 10, 0, 1, 81, 48, 1, 3, 81, 8, 81, 135, 85, 5, 0, 2, 86, 83, 81, 0, 59, 27, 0, 0, 60, 25, 0, 1, 81, 0, 0, 135, 85, 33, 0, 0, 59, 60, 81, 135, 85, 2, 0, 94, 81, 8, 77, 135, 85, 170, 0, 81, 0, 0, 0, 1, 81, 0, 0, 135, 85, 170, 0, 81, 0, 0, 0, 1, 85, 0, 0, 1, 81, 0, 0, 1, 83, 1, 0, 135, 26, 33, 0, 0, 85, 81, 83, 135, 37, 2, 0, 135, 35, 20, 0, 26, 37, 9, 10, 135, 20, 2, 0, 15, 83, 20, 12, 13, 81, 20, 12, 16, 85, 35, 11, 19, 81, 81, 85, 20, 83, 83, 81, 33, 81, 5, 0, 33, 85, 6, 0, 20, 81, 81, 85, 40, 81, 81, 1, 20, 83, 83, 81, 121, 83, 4, 0, 0, 17, 26, 0, 0, 18, 37, 0, 119, 0, 239, 251, 0, 61, 26, 0, 0, 62, 37, 0, 1, 7, 4, 0, 119, 0, 18, 0, 32, 83, 7, 7, 121, 83, 6, 0, 1, 81, 0, 0, 135, 83, 33, 0, 0, 17, 18, 81, 135, 83, 2, 0, 119, 0, 11, 0, 32, 83, 7, 109, 121, 83, 9, 0, 1, 81, 0, 0, 135, 83, 33, 0, 0, 17, 18, 81, 135, 83, 2, 0, 119, 0, 4, 0, 0, 61, 13, 0, 0, 62, 14, 0, 1, 7, 4, 0, 32, 83, 7, 4, 121, 83, 5, 0, 1, 81, 0, 0, 135, 83, 33, 0, 0, 61, 62, 81, 135, 83, 2, 0, 1, 81, 0, 0, 2, 85, 0, 0, 0, 157, 0, 0, 135, 83, 173, 0, 1, 81, 85, 0, 1, 85, 0, 0, 2, 81, 0, 0, 96, 160, 0, 0, 135, 83, 173, 0, 1, 85, 81, 0, 1, 81, 0, 0, 2, 85, 0, 0, 128, 157, 0, 0, 135, 83, 173, 0, 1, 81, 85, 0, 1, 83, 0, 0, 85, 8, 83, 0, 1, 85, 0, 0, 109, 8, 4, 85, 1, 83, 0, 0, 109, 8, 8, 83, 1, 85, 0, 0, 109, 8, 12, 85, 1, 83, 0, 0, 107, 8, 16, 83, 82, 83, 1, 0, 2, 85, 0, 0, 110, 147, 11, 0, 1, 81, 0, 0, 1, 86, 1, 0, 135, 62, 6, 0, 83, 85, 81, 86, 120, 62, 3, 0, 1, 7, 116, 0, 119, 0, 23, 0, 106, 61, 62, 4, 135, 86, 174, 0, 61, 0, 0, 0, 32, 86, 86, 4, 121, 86, 17, 0, 0, 62, 61, 0, 78, 63, 62, 0, 26, 86, 63, 48, 19, 86, 86, 73, 34, 86, 86, 10, 121, 86, 3, 0, 25, 62, 62, 1, 119, 0, 250, 255, 41, 86, 63, 24, 42, 86, 86, 24, 120, 86, 4, 0, 0, 64, 61, 0, 1, 7, 121, 0, 119, 0, 4, 0, 1, 7, 116, 0, 119, 0, 2, 0, 1, 7, 116, 0, 32, 86, 7, 116, 121, 86, 27, 0, 82, 86, 1, 0, 2, 81, 0, 0, 160, 218, 10, 0, 1, 85, 0, 0, 1, 83, 1, 0, 135, 61, 6, 0, 86, 81, 85, 83, 121, 61, 19, 0, 106, 63, 61, 4, 135, 83, 174, 0, 63, 0, 0, 0, 32, 83, 83, 4, 121, 83, 14, 0, 0, 61, 63, 0, 78, 65, 61, 0, 26, 83, 65, 48, 19, 83, 83, 73, 34, 83, 83, 10, 121, 83, 3, 0, 25, 61, 61, 1, 119, 0, 250, 255, 41, 83, 65, 24, 42, 83, 83, 24, 120, 83, 3, 0, 0, 64, 63, 0, 1, 7, 121, 0, 32, 83, 7, 121, 121, 83, 199, 0, 1, 85, 5, 0, 135, 83, 175, 0, 8, 64, 85, 0, 2, 85, 0, 0, 110, 147, 11, 0, 1, 81, 0, 0, 1, 86, 0, 0, 135, 83, 4, 0, 1, 85, 81, 86, 2, 86, 0, 0, 160, 218, 10, 0, 1, 81, 0, 0, 1, 85, 0, 0, 135, 83, 4, 0, 1, 86, 81, 85, 82, 83, 1, 0, 2, 85, 0, 0, 124, 147, 11, 0, 1, 81, 0, 0, 1, 86, 1, 0, 135, 64, 6, 0, 83, 85, 81, 86, 120, 64, 3, 0, 1, 7, 126, 0, 119, 0, 23, 0, 106, 63, 64, 4, 135, 86, 174, 0, 63, 0, 0, 0, 32, 86, 86, 4, 121, 86, 17, 0, 0, 64, 63, 0, 78, 66, 64, 0, 26, 86, 66, 48, 19, 86, 86, 73, 34, 86, 86, 10, 121, 86, 3, 0, 25, 64, 64, 1, 119, 0, 250, 255, 41, 86, 66, 24, 42, 86, 86, 24, 120, 86, 4, 0, 0, 67, 63, 0, 1, 7, 131, 0, 119, 0, 4, 0, 1, 7, 126, 0, 119, 0, 2, 0, 1, 7, 126, 0, 32, 86, 7, 126, 121, 86, 27, 0, 82, 86, 1, 0, 2, 81, 0, 0, 164, 218, 10, 0, 1, 85, 0, 0, 1, 83, 1, 0, 135, 63, 6, 0, 86, 81, 85, 83, 121, 63, 19, 0, 106, 66, 63, 4, 135, 83, 174, 0, 66, 0, 0, 0, 32, 83, 83, 4, 121, 83, 14, 0, 0, 63, 66, 0, 78, 68, 63, 0, 26, 83, 68, 48, 19, 83, 83, 73, 34, 83, 83, 10, 121, 83, 3, 0, 25, 63, 63, 1, 119, 0, 250, 255, 41, 83, 68, 24, 42, 83, 83, 24, 120, 83, 3, 0, 0, 67, 66, 0, 1, 7, 131, 0, 1, 83, 131, 0, 45, 83, 7, 83, 136, 245, 0, 0, 1, 83, 56, 1, 25, 85, 67, 2, 97, 8, 83, 85, 1, 85, 56, 1, 3, 85, 8, 85, 109, 85, 4, 67, 25, 83, 8, 4, 1, 81, 13, 0, 2, 86, 0, 0, 168, 218, 10, 0, 1, 84, 56, 1, 3, 84, 8, 84, 135, 85, 10, 0, 83, 81, 86, 84, 2, 84, 0, 0, 124, 147, 11, 0, 1, 86, 0, 0, 1, 81, 0, 0, 135, 85, 4, 0, 1, 84, 86, 81, 2, 81, 0, 0, 164, 218, 10, 0, 1, 86, 0, 0, 1, 84, 0, 0, 135, 85, 4, 0, 1, 81, 86, 84, 82, 85, 1, 0, 2, 84, 0, 0, 179, 218, 10, 0, 1, 86, 0, 0, 1, 81, 1, 0, 135, 66, 6, 0, 85, 84, 86, 81, 120, 66, 3, 0, 1, 7, 136, 0, 119, 0, 22, 0, 106, 68, 66, 4, 135, 81, 174, 0, 68, 0, 0, 0, 32, 81, 81, 4, 121, 81, 16, 0, 0, 66, 68, 0, 78, 69, 66, 0, 26, 81, 69, 48, 19, 81, 81, 73, 34, 81, 81, 10, 121, 81, 3, 0, 25, 66, 66, 1, 119, 0, 250, 255, 41, 81, 69, 24, 42, 81, 81, 24, 120, 81, 3, 0, 0, 70, 68, 0, 119, 0, 4, 0, 1, 7, 136, 0, 119, 0, 2, 0, 1, 7, 136, 0, 1, 81, 136, 0, 45, 81, 7, 81, 32, 245, 0, 0, 82, 81, 1, 0, 2, 86, 0, 0, 184, 218, 10, 0, 1, 84, 0, 0, 1, 85, 1, 0, 135, 66, 6, 0, 81, 86, 84, 85, 120, 66, 2, 0, 119, 0, 45, 0, 106, 18, 66, 4, 135, 85, 174, 0, 18, 0, 0, 0, 33, 85, 85, 4, 120, 85, 40, 0, 0, 66, 18, 0, 78, 71, 66, 0, 26, 85, 71, 48, 19, 85, 85, 73, 34, 85, 85, 10, 121, 85, 3, 0, 25, 66, 66, 1, 119, 0, 250, 255, 41, 85, 71, 24, 42, 85, 85, 24, 120, 85, 29, 0, 0, 70, 18, 0, 119, 0, 1, 0, 1, 85, 64, 1, 97, 8, 85, 70, 1, 85, 64, 1, 3, 85, 8, 85, 25, 84, 70, 2, 109, 85, 4, 84, 25, 85, 8, 10, 1, 86, 7, 0, 2, 81, 0, 0, 188, 218, 10, 0, 1, 83, 64, 1, 3, 83, 8, 83, 135, 84, 10, 0, 85, 86, 81, 83, 2, 83, 0, 0, 179, 218, 10, 0, 1, 81, 0, 0, 1, 86, 0, 0, 135, 84, 4, 0, 1, 83, 81, 86, 2, 86, 0, 0, 184, 218, 10, 0, 1, 81, 0, 0, 1, 83, 0, 0, 135, 84, 4, 0, 1, 86, 81, 83, 78, 84, 8, 0, 121, 84, 6, 0, 2, 83, 0, 0, 105, 147, 11, 0, 1, 81, 0, 0, 135, 84, 4, 0, 1, 83, 8, 81, 137, 8, 0, 0, 139, 0, 0, 0, 140, 2, 63, 0, 0, 0, 0, 0, 2, 53, 0, 0, 240, 1, 0, 0, 2, 54, 0, 0, 248, 1, 0, 0, 2, 55, 0, 0, 0, 0, 0, 128, 2, 56, 0, 0, 184, 0, 0, 0, 2, 57, 0, 0, 200, 0, 0, 0, 2, 58, 0, 0, 176, 0, 0, 0, 1, 2, 0, 0, 136, 59, 0, 0, 0, 3, 59, 0, 136, 59, 0, 0, 25, 59, 59, 64, 137, 59, 0, 0, 1, 59, 12, 5, 94, 59, 0, 59, 106, 4, 59, 24, 121, 4, 27, 0, 0, 5, 1, 0, 0, 6, 4, 0, 25, 7, 5, 72, 116, 5, 6, 0, 25, 5, 5, 4, 25, 6, 6, 4, 54, 59, 5, 7, 24, 246, 0, 0, 106, 59, 0, 28, 106, 60, 1, 32, 41, 60, 60, 2, 94, 8, 59, 60, 1, 59, 12, 5, 94, 59, 0, 59, 106, 59, 59, 40, 34, 59, 59, 1, 121, 59, 4, 0, 1, 60, 0, 0, 135, 59, 176, 0, 0, 8, 60, 0, 1, 59, 184, 1, 94, 59, 8, 59, 34, 59, 59, 1, 121, 59, 3, 0, 1, 2, 6, 0, 119, 0, 130, 3, 1, 60, 0, 0, 109, 1, 24, 60, 1, 59, 0, 0, 109, 1, 28, 59, 135, 59, 63, 0, 1, 0, 0, 0, 106, 59, 0, 4, 106, 59, 59, 48, 1, 60, 255, 0, 19, 59, 59, 60, 135, 8, 177, 0, 59, 0, 1, 0, 34, 59, 8, 0, 121, 59, 47, 0, 2, 59, 0, 0, 174, 186, 187, 176, 46, 59, 8, 59, 96, 247, 0, 0, 32, 59, 4, 0, 32, 60, 8, 245, 20, 59, 59, 60, 121, 59, 4, 0, 0, 9, 8, 0, 1, 2, 132, 0, 119, 0, 105, 3, 106, 59, 0, 24, 121, 59, 200, 255, 1, 10, 0, 0, 106, 59, 0, 28, 41, 60, 10, 2, 94, 11, 59, 60, 1, 59, 220, 0, 94, 59, 11, 59, 120, 59, 8, 0, 1, 59, 0, 0, 1, 60, 184, 1, 94, 60, 11, 60, 47, 59, 59, 60, 20, 247, 0, 0, 1, 2, 15, 0, 119, 0, 2, 0, 1, 2, 15, 0, 32, 59, 2, 15, 121, 59, 12, 0, 1, 2, 0, 0, 1, 60, 0, 0, 135, 59, 176, 0, 0, 11, 60, 0, 1, 59, 1, 0, 1, 60, 184, 1, 94, 60, 11, 60, 49, 59, 59, 60, 80, 247, 0, 0, 1, 2, 16, 0, 119, 0, 75, 3, 25, 10, 10, 1, 106, 59, 0, 24, 55, 59, 10, 59, 228, 246, 0, 0, 119, 0, 167, 255, 135, 10, 178, 0, 1, 0, 0, 0, 34, 59, 10, 0, 121, 59, 4, 0, 0, 9, 10, 0, 1, 2, 132, 0, 119, 0, 63, 3, 1, 59, 72, 4, 94, 59, 0, 59, 1, 60, 0, 1, 19, 59, 59, 60, 121, 59, 15, 0, 106, 59, 1, 36, 38, 59, 59, 2, 121, 59, 12, 0, 106, 60, 1, 32, 109, 3, 16, 60, 1, 59, 24, 0, 2, 61, 0, 0, 217, 105, 11, 0, 25, 62, 3, 16, 135, 60, 5, 0, 0, 59, 61, 62, 135, 60, 60, 0, 1, 0, 0, 0, 119, 0, 141, 255, 106, 10, 1, 32, 106, 11, 0, 24, 50, 60, 11, 10, 252, 247, 0, 0, 109, 3, 24, 10, 1, 62, 16, 0, 2, 61, 0, 0, 1, 106, 11, 0, 25, 59, 3, 24, 135, 60, 5, 0, 0, 62, 61, 59, 119, 0, 129, 255, 106, 12, 0, 28, 41, 60, 10, 2, 94, 13, 12, 60, 106, 14, 1, 16, 25, 60, 1, 16, 106, 15, 60, 4, 32, 60, 14, 0, 13, 59, 15, 55, 19, 60, 60, 59, 121, 60, 5, 0, 106, 16, 1, 8, 25, 60, 1, 8, 106, 17, 60, 4, 119, 0, 3, 0, 0, 16, 14, 0, 0, 17, 15, 0, 94, 59, 13, 53, 32, 59, 59, 0, 121, 59, 6, 0, 3, 59, 13, 53, 106, 59, 59, 4, 13, 59, 59, 55, 0, 60, 59, 0, 119, 0, 3, 0, 1, 59, 0, 0, 0, 60, 59, 0, 121, 60, 35, 2, 94, 18, 13, 56, 32, 60, 16, 0, 13, 59, 17, 55, 19, 60, 60, 59, 1, 59, 62, 0, 15, 59, 59, 18, 20, 60, 60, 59, 120, 60, 27, 2, 1, 60, 240, 4, 94, 60, 0, 60, 121, 60, 24, 2, 1, 60, 1, 0, 1, 59, 0, 0, 135, 19, 49, 0, 60, 59, 18, 0, 135, 20, 2, 0, 1, 59, 255, 255, 1, 60, 255, 255, 135, 21, 44, 0, 19, 20, 59, 60, 19, 60, 21, 16, 0, 22, 60, 0, 135, 60, 2, 0, 19, 60, 60, 17, 0, 21, 60, 0, 106, 23, 13, 20, 106, 24, 13, 16, 1, 60, 60, 0, 1, 59, 0, 0, 34, 61, 23, 0, 41, 61, 61, 31, 42, 61, 61, 31, 34, 62, 24, 0, 41, 62, 62, 31, 42, 62, 62, 31, 135, 25, 40, 0, 60, 59, 23, 61, 24, 62, 0, 0, 135, 24, 2, 0, 135, 23, 20, 0, 22, 21, 25, 24, 135, 26, 2, 0, 1, 62, 1, 0, 1, 61, 0, 0, 26, 59, 18, 3, 135, 27, 49, 0, 62, 61, 59, 0, 135, 59, 2, 0, 135, 18, 20, 0, 19, 20, 27, 59, 135, 27, 2, 0, 135, 28, 20, 0, 19, 20, 25, 24, 135, 24, 2, 0, 15, 59, 21, 27, 13, 61, 21, 27, 16, 62, 22, 18, 19, 61, 61, 62, 20, 59, 59, 61, 15, 61, 21, 24, 13, 62, 21, 24, 16, 60, 22, 28, 19, 62, 62, 60, 20, 61, 61, 62, 20, 59, 59, 61, 1, 61, 1, 0, 1, 62, 255, 255, 125, 25, 59, 61, 62, 0, 0, 0, 1, 62, 104, 4, 94, 28, 0, 62, 120, 28, 3, 0, 1, 2, 38, 0, 119, 0, 194, 0, 1, 62, 108, 4, 94, 22, 0, 62, 1, 24, 0, 0, 41, 62, 24, 2, 94, 29, 22, 62, 121, 29, 12, 0, 106, 21, 29, 16, 121, 21, 10, 0, 106, 18, 29, 12, 1, 27, 0, 0, 41, 62, 27, 2, 94, 62, 18, 62, 52, 62, 62, 10, 236, 249, 0, 0, 25, 27, 27, 1, 55, 62, 27, 21, 184, 249, 0, 0, 25, 24, 24, 1, 50, 62, 28, 24, 232, 249, 0, 0, 1, 2, 37, 0, 119, 0, 2, 0, 119, 0, 237, 255, 32, 62, 2, 37, 121, 62, 9, 0, 1, 2, 0, 0, 120, 11, 5, 0, 1, 30, 255, 255, 1, 31, 1, 0, 1, 2, 45, 0, 119, 0, 163, 0, 1, 2, 38, 0, 119, 0, 161, 0, 0, 24, 29, 0, 25, 21, 24, 56, 82, 32, 21, 0, 106, 33, 21, 4, 32, 62, 32, 0, 13, 61, 33, 55, 19, 62, 62, 61, 120, 62, 3, 0, 1, 2, 64, 0, 119, 0, 43, 0, 1, 21, 0, 0, 0, 27, 24, 0, 41, 62, 21, 2, 94, 34, 22, 62, 45, 62, 34, 27, 92, 250, 0, 0, 1, 35, 0, 0, 119, 0, 19, 0, 120, 27, 17, 0, 106, 18, 34, 16, 120, 18, 3, 0, 1, 35, 0, 0, 119, 0, 14, 0, 106, 36, 34, 12, 1, 37, 0, 0, 41, 62, 37, 2, 94, 62, 36, 62, 52, 62, 62, 10, 200, 250, 0, 0, 25, 37, 37, 1, 50, 62, 18, 37, 156, 250, 0, 0, 1, 35, 0, 0, 119, 0, 3, 0, 119, 0, 247, 255, 0, 35, 27, 0, 25, 21, 21, 1, 50, 62, 28, 21, 192, 250, 0, 0, 0, 38, 25, 0, 0, 39, 23, 0, 0, 40, 26, 0, 119, 0, 10, 0, 0, 27, 35, 0, 119, 0, 224, 255, 120, 34, 5, 0, 0, 38, 25, 0, 0, 39, 23, 0, 0, 40, 26, 0, 119, 0, 3, 0, 0, 24, 34, 0, 119, 0, 206, 255, 32, 62, 2, 64, 121, 62, 5, 0, 1, 2, 0, 0, 106, 38, 24, 64, 0, 39, 32, 0, 0, 40, 33, 0, 0, 27, 29, 0, 25, 21, 27, 56, 82, 61, 21, 0, 45, 61, 61, 39, 32, 251, 0, 0, 106, 61, 21, 4, 13, 61, 61, 40, 0, 62, 61, 0, 119, 0, 3, 0, 1, 61, 0, 0, 0, 62, 61, 0, 121, 62, 35, 0, 1, 18, 0, 0, 0, 37, 27, 0, 41, 62, 18, 2, 94, 36, 22, 62, 45, 62, 36, 37, 76, 251, 0, 0, 1, 41, 0, 0, 119, 0, 22, 0, 121, 37, 3, 0, 0, 41, 37, 0, 119, 0, 19, 0, 106, 42, 36, 16, 120, 42, 3, 0, 1, 41, 0, 0, 119, 0, 15, 0, 106, 43, 36, 12, 1, 44, 0, 0, 41, 62, 44, 2, 94, 62, 43, 62, 45, 62, 62, 10, 136, 251, 0, 0, 0, 45, 36, 0, 119, 0, 64, 0, 25, 44, 44, 1, 50, 62, 42, 44, 156, 251, 0, 0, 1, 41, 0, 0, 119, 0, 2, 0, 119, 0, 245, 255, 25, 18, 18, 1, 57, 62, 28, 18, 148, 252, 0, 0, 0, 37, 41, 0, 119, 0, 225, 255, 106, 37, 27, 16, 121, 37, 14, 0, 106, 18, 27, 12, 1, 36, 0, 0, 41, 62, 36, 2, 94, 62, 18, 62, 41, 62, 62, 2, 94, 42, 12, 62, 97, 42, 53, 39, 3, 62, 42, 53, 109, 62, 4, 40, 97, 42, 54, 38, 25, 36, 36, 1, 53, 62, 36, 37, 196, 251, 0, 0, 85, 21, 39, 0, 109, 21, 4, 40, 109, 27, 64, 38, 1, 37, 0, 0, 0, 36, 27, 0, 41, 62, 37, 2, 94, 18, 22, 62, 45, 62, 18, 36, 28, 252, 0, 0, 1, 46, 0, 0, 119, 0, 22, 0, 121, 36, 3, 0, 0, 46, 36, 0, 119, 0, 19, 0, 106, 42, 18, 16, 120, 42, 3, 0, 1, 46, 0, 0, 119, 0, 15, 0, 106, 44, 18, 12, 1, 43, 0, 0, 41, 62, 43, 2, 94, 62, 44, 62, 45, 62, 62, 10, 88, 252, 0, 0, 0, 45, 18, 0, 119, 0, 12, 0, 25, 43, 43, 1, 50, 62, 42, 43, 108, 252, 0, 0, 1, 46, 0, 0, 119, 0, 2, 0, 119, 0, 245, 255, 25, 37, 37, 1, 57, 62, 28, 37, 148, 252, 0, 0, 0, 36, 46, 0, 119, 0, 225, 255, 120, 45, 2, 0, 119, 0, 3, 0, 0, 27, 45, 0, 119, 0, 156, 255, 32, 62, 2, 38, 121, 62, 77, 0, 1, 2, 0, 0, 2, 10, 0, 0, 0, 0, 0, 128, 1, 27, 0, 0, 1, 22, 0, 0, 41, 62, 22, 2, 94, 24, 12, 62, 94, 21, 24, 58, 82, 62, 21, 0, 1, 61, 0, 0, 1, 59, 2, 0, 138, 62, 61, 59, 220, 252, 0, 0, 52, 253, 0, 0, 1, 48, 0, 0, 119, 0, 30, 0, 106, 61, 24, 48, 1, 59, 0, 4, 19, 61, 61, 59, 32, 61, 61, 0, 1, 59, 0, 0, 1, 60, 112, 254, 125, 36, 61, 59, 60, 0, 0, 0, 106, 60, 21, 48, 120, 60, 3, 0, 0, 47, 36, 0, 119, 0, 9, 0, 106, 59, 21, 52, 32, 59, 59, 0, 121, 59, 3, 0, 0, 60, 36, 0, 119, 0, 3, 0, 25, 59, 36, 50, 0, 60, 59, 0, 0, 47, 60, 0, 25, 48, 47, 25, 119, 0, 8, 0, 106, 60, 21, 108, 32, 60, 60, 0, 1, 59, 0, 0, 1, 61, 50, 0, 125, 48, 60, 59, 61, 0, 0, 0, 119, 0, 1, 0, 1, 61, 224, 0, 94, 61, 24, 61, 32, 61, 61, 0, 121, 61, 3, 0, 0, 62, 48, 0, 119, 0, 3, 0, 25, 61, 48, 12, 0, 62, 61, 0, 0, 21, 62, 0, 106, 61, 24, 52, 32, 61, 61, 48, 121, 61, 3, 0, 0, 62, 21, 0, 119, 0, 3, 0, 3, 61, 21, 57, 0, 62, 61, 0, 0, 36, 62, 0, 15, 21, 10, 36, 125, 24, 21, 22, 27, 0, 0, 0, 25, 22, 22, 1, 45, 62, 22, 11, 188, 253, 0, 0, 0, 30, 24, 0, 1, 31, 0, 0, 1, 2, 45, 0, 119, 0, 5, 0, 125, 10, 21, 36, 10, 0, 0, 0, 0, 27, 24, 0, 119, 0, 186, 255, 32, 62, 2, 45, 121, 62, 67, 0, 1, 2, 0, 0, 41, 62, 30, 2, 94, 27, 12, 62, 94, 10, 27, 53, 3, 62, 27, 53, 106, 22, 62, 4, 32, 62, 10, 0, 13, 61, 22, 55, 19, 62, 62, 61, 120, 62, 7, 0, 97, 13, 53, 10, 3, 62, 13, 53, 109, 62, 4, 22, 94, 61, 27, 54, 97, 13, 54, 61, 119, 0, 51, 0, 120, 31, 50, 0, 120, 28, 12, 0, 1, 27, 0, 0, 41, 61, 27, 2, 94, 22, 12, 61, 97, 22, 53, 23, 3, 61, 22, 53, 109, 61, 4, 26, 97, 22, 54, 25, 25, 27, 27, 1, 52, 61, 27, 11, 220, 254, 0, 0, 119, 0, 247, 255, 1, 61, 108, 4, 94, 27, 0, 61, 1, 22, 0, 0, 1, 10, 0, 0, 41, 61, 10, 2, 94, 24, 27, 61, 121, 24, 13, 0, 106, 36, 24, 16, 120, 36, 2, 0, 119, 0, 10, 0, 106, 21, 24, 12, 1, 37, 0, 0, 41, 61, 37, 2, 94, 61, 21, 61, 52, 61, 61, 22, 172, 254, 0, 0, 25, 37, 37, 1, 55, 61, 37, 36, 120, 254, 0, 0, 25, 10, 10, 1, 50, 61, 28, 10, 168, 254, 0, 0, 1, 2, 58, 0, 119, 0, 2, 0, 119, 0, 236, 255, 32, 61, 2, 58, 121, 61, 8, 0, 1, 2, 0, 0, 41, 61, 22, 2, 94, 10, 12, 61, 97, 10, 53, 23, 3, 61, 10, 53, 109, 61, 4, 26, 97, 10, 54, 25, 25, 22, 22, 1, 53, 61, 22, 11, 84, 254, 0, 0, 94, 61, 13, 54, 32, 61, 61, 255, 121, 61, 131, 0, 1, 61, 192, 0, 94, 11, 13, 61, 1, 61, 192, 0, 3, 61, 13, 61, 106, 25, 61, 4, 2, 61, 0, 0, 0, 0, 254, 127, 15, 61, 25, 61, 2, 62, 0, 0, 0, 0, 254, 127, 13, 62, 25, 62, 35, 59, 11, 0, 19, 62, 62, 59, 20, 61, 61, 62, 121, 61, 32, 0, 94, 26, 13, 53, 3, 61, 13, 53, 106, 23, 61, 4, 15, 61, 25, 23, 13, 62, 23, 25, 16, 59, 11, 26, 19, 62, 62, 59, 20, 61, 61, 62, 32, 62, 11, 0, 13, 59, 25, 55, 19, 62, 62, 59, 32, 59, 26, 0, 13, 60, 23, 55, 19, 59, 59, 60, 20, 62, 62, 59, 20, 61, 61, 62, 0, 12, 61, 0, 1, 62, 0, 0, 125, 61, 12, 62, 19, 0, 0, 0, 1, 59, 0, 0, 125, 62, 12, 59, 20, 0, 0, 0, 135, 23, 20, 0, 11, 25, 61, 62, 135, 12, 2, 0, 1, 62, 192, 0, 97, 13, 62, 23, 1, 62, 192, 0, 3, 62, 13, 62, 109, 62, 4, 12, 106, 12, 13, 24, 25, 62, 13, 24, 106, 23, 62, 4, 2, 62, 0, 0, 0, 0, 254, 127, 15, 62, 23, 62, 2, 61, 0, 0, 0, 0, 254, 127, 13, 61, 23, 61, 35, 59, 12, 0, 19, 61, 61, 59, 20, 62, 62, 61, 121, 62, 30, 0, 94, 25, 13, 53, 3, 62, 13, 53, 106, 11, 62, 4, 15, 62, 23, 11, 13, 61, 11, 23, 16, 59, 12, 25, 19, 61, 61, 59, 20, 62, 62, 61, 32, 61, 12, 0, 13, 59, 23, 55, 19, 61, 61, 59, 32, 59, 25, 0, 13, 60, 11, 55, 19, 59, 59, 60, 20, 61, 61, 59, 20, 62, 62, 61, 0, 26, 62, 0, 1, 61, 0, 0, 125, 62, 26, 61, 19, 0, 0, 0, 1, 59, 0, 0, 125, 61, 26, 59, 20, 0, 0, 0, 135, 11, 20, 0, 12, 23, 62, 61, 135, 26, 2, 0, 109, 13, 24, 11, 25, 61, 13, 24, 109, 61, 4, 26, 94, 26, 13, 57, 3, 61, 13, 57, 106, 11, 61, 4, 2, 61, 0, 0, 0, 0, 254, 127, 15, 61, 11, 61, 2, 62, 0, 0, 0, 0, 254, 127, 13, 62, 11, 62, 35, 59, 26, 0, 19, 62, 62, 59, 20, 61, 61, 62, 121, 61, 30, 0, 94, 23, 13, 53, 3, 61, 13, 53, 106, 12, 61, 4, 15, 61, 11, 12, 13, 62, 12, 11, 16, 59, 26, 23, 19, 62, 62, 59, 20, 61, 61, 62, 32, 62, 26, 0, 13, 59, 11, 55, 19, 62, 62, 59, 32, 59, 23, 0, 13, 60, 12, 55, 19, 59, 59, 60, 20, 62, 62, 59, 20, 61, 61, 62, 0, 25, 61, 0, 1, 62, 0, 0, 125, 61, 25, 62, 19, 0, 0, 0, 1, 59, 0, 0, 125, 62, 25, 59, 20, 0, 0, 0, 135, 12, 20, 0, 26, 11, 61, 62, 135, 25, 2, 0, 97, 13, 57, 12, 3, 62, 13, 57, 109, 62, 4, 25, 94, 25, 13, 54, 120, 25, 5, 0, 106, 49, 1, 8, 25, 62, 1, 8, 106, 50, 62, 4, 119, 0, 112, 0, 94, 12, 13, 53, 3, 62, 13, 53, 106, 11, 62, 4, 33, 62, 14, 0, 14, 61, 15, 55, 20, 62, 62, 61, 33, 61, 12, 0, 14, 59, 11, 55, 20, 61, 61, 59, 19, 62, 62, 61, 121, 62, 42, 0, 32, 62, 25, 1, 15, 61, 15, 11, 13, 59, 11, 15, 16, 60, 14, 12, 19, 59, 59, 60, 20, 61, 61, 59, 19, 62, 62, 61, 121, 62, 12, 0, 1, 62, 1, 0, 1, 61, 0, 0, 94, 59, 13, 56, 135, 26, 49, 0, 62, 61, 59, 0, 135, 59, 2, 0, 135, 23, 44, 0, 26, 59, 14, 15, 0, 51, 23, 0, 135, 52, 2, 0, 119, 0, 25, 0, 33, 59, 25, 255, 15, 61, 15, 11, 13, 62, 11, 15, 16, 60, 14, 12, 19, 62, 62, 60, 20, 61, 61, 62, 20, 59, 59, 61, 121, 59, 4, 0, 0, 51, 14, 0, 0, 52, 15, 0, 119, 0, 14, 0, 1, 59, 1, 0, 1, 61, 0, 0, 94, 62, 13, 56, 135, 23, 49, 0, 59, 61, 62, 0, 135, 62, 2, 0, 135, 26, 20, 0, 14, 15, 23, 62, 0, 51, 26, 0, 135, 52, 2, 0, 119, 0, 3, 0, 0, 51, 14, 0, 0, 52, 15, 0, 109, 1, 16, 51, 25, 62, 1, 16, 109, 62, 4, 52, 106, 26, 1, 8, 25, 62, 1, 8, 106, 23, 62, 4, 33, 62, 26, 0, 14, 61, 23, 55, 20, 62, 62, 61, 33, 61, 12, 0, 14, 59, 11, 55, 20, 61, 61, 59, 19, 62, 62, 61, 121, 62, 42, 0, 32, 62, 25, 1, 15, 61, 23, 11, 13, 59, 11, 23, 16, 60, 26, 12, 19, 59, 59, 60, 20, 61, 61, 59, 19, 62, 62, 61, 121, 62, 12, 0, 1, 62, 1, 0, 1, 61, 0, 0, 94, 59, 13, 56, 135, 28, 49, 0, 62, 61, 59, 0, 135, 59, 2, 0, 135, 22, 44, 0, 28, 59, 26, 23, 0, 49, 22, 0, 135, 50, 2, 0, 119, 0, 25, 0, 33, 59, 25, 255, 15, 61, 23, 11, 13, 62, 11, 23, 16, 60, 26, 12, 19, 62, 62, 60, 20, 61, 61, 62, 20, 59, 59, 61, 121, 59, 4, 0, 0, 49, 26, 0, 0, 50, 23, 0, 119, 0, 14, 0, 1, 59, 1, 0, 1, 61, 0, 0, 94, 62, 13, 56, 135, 22, 49, 0, 59, 61, 62, 0, 135, 62, 2, 0, 135, 28, 20, 0, 26, 23, 22, 62, 0, 49, 28, 0, 135, 50, 2, 0, 119, 0, 3, 0, 0, 49, 26, 0, 0, 50, 23, 0, 109, 1, 8, 49, 25, 62, 1, 8, 109, 62, 4, 50, 94, 25, 13, 58, 82, 62, 25, 0, 1, 61, 0, 0, 1, 59, 4, 0, 138, 62, 61, 59, 248, 2, 1, 0, 12, 3, 1, 0, 32, 3, 1, 0, 52, 3, 1, 0, 119, 0, 21, 0, 1, 61, 112, 4, 94, 15, 0, 61, 121, 15, 18, 0, 109, 25, 4, 15, 119, 0, 16, 0, 1, 61, 116, 4, 94, 15, 0, 61, 121, 15, 13, 0, 109, 25, 4, 15, 119, 0, 11, 0, 1, 61, 60, 5, 94, 15, 0, 61, 121, 15, 8, 0, 109, 25, 4, 15, 119, 0, 6, 0, 1, 61, 120, 4, 94, 15, 0, 61, 121, 15, 3, 0, 109, 25, 4, 15, 119, 0, 1, 0, 1, 62, 216, 4, 94, 62, 0, 62, 121, 62, 32, 0, 135, 15, 179, 0, 135, 25, 2, 0, 1, 61, 1, 0, 109, 3, 32, 61, 25, 61, 3, 32, 25, 14, 61, 4, 2, 61, 0, 0, 64, 66, 15, 0, 85, 14, 61, 0, 106, 62, 3, 32, 109, 3, 40, 62, 25, 62, 3, 40, 82, 61, 14, 0, 109, 62, 4, 61, 106, 62, 13, 16, 109, 3, 48, 62, 25, 62, 3, 48, 25, 61, 13, 16, 106, 61, 61, 4, 109, 62, 4, 61, 25, 61, 3, 40, 25, 62, 3, 48, 135, 14, 34, 0, 15, 25, 61, 62, 135, 25, 2, 0, 109, 1, 8, 14, 25, 62, 1, 8, 109, 62, 4, 25, 109, 1, 16, 14, 25, 62, 1, 16, 109, 62, 4, 25, 120, 4, 8, 0, 1, 62, 184, 1, 94, 62, 13, 62, 34, 62, 62, 1, 121, 62, 4, 0, 0, 9, 8, 0, 1, 2, 132, 0, 119, 0, 35, 0, 1, 62, 12, 5, 94, 25, 0, 62, 1, 62, 80, 0, 135, 14, 93, 0, 62, 0, 0, 0, 120, 14, 4, 0, 1, 9, 244, 255, 1, 2, 132, 0, 119, 0, 26, 0, 0, 5, 14, 0, 0, 6, 1, 0, 25, 7, 5, 72, 116, 5, 6, 0, 25, 5, 5, 4, 25, 6, 6, 4, 54, 62, 5, 7, 32, 4, 1, 0, 106, 62, 25, 24, 120, 62, 3, 0, 109, 25, 24, 14, 119, 0, 3, 0, 106, 62, 25, 28, 109, 62, 72, 14, 109, 25, 28, 14, 1, 62, 12, 5, 94, 62, 0, 62, 25, 15, 62, 40, 82, 62, 15, 0, 106, 61, 1, 28, 4, 62, 62, 61, 85, 15, 62, 0, 135, 62, 176, 0, 0, 13, 1, 0, 119, 0, 98, 252, 32, 62, 2, 6, 121, 62, 15, 0, 1, 62, 12, 5, 94, 6, 0, 62, 106, 61, 4, 72, 109, 6, 24, 61, 106, 62, 6, 40, 106, 59, 1, 28, 3, 62, 62, 59, 109, 6, 40, 62, 135, 62, 170, 0, 4, 0, 0, 0, 1, 9, 0, 0, 137, 3, 0, 0, 139, 9, 0, 0, 119, 0, 24, 0, 32, 62, 2, 16, 121, 62, 17, 0, 2, 62, 0, 0, 194, 105, 11, 0, 85, 3, 62, 0, 2, 61, 0, 0, 169, 103, 11, 0, 109, 3, 4, 61, 1, 62, 102, 3, 109, 3, 8, 62, 1, 61, 0, 0, 1, 59, 0, 0, 2, 60, 0, 0, 102, 48, 13, 0, 135, 62, 5, 0, 61, 59, 60, 3, 135, 62, 62, 0, 119, 0, 6, 0, 1, 62, 132, 0, 45, 62, 2, 62, 20, 5, 1, 0, 137, 3, 0, 0, 139, 9, 0, 0, 1, 62, 0, 0, 139, 62, 0, 0, 140, 2, 55, 0, 0, 0, 0, 0, 2, 43, 0, 0, 176, 0, 0, 0, 2, 44, 0, 0, 184, 0, 0, 0, 2, 45, 0, 0, 228, 0, 0, 0, 2, 46, 0, 0, 232, 0, 0, 0, 2, 47, 0, 0, 0, 16, 0, 0, 1, 2, 0, 0, 136, 48, 0, 0, 0, 3, 48, 0, 136, 48, 0, 0, 1, 49, 224, 1, 3, 48, 48, 49, 137, 48, 0, 0, 1, 48, 16, 1, 1, 49, 0, 0, 97, 3, 48, 49, 135, 49, 63, 0, 1, 0, 0, 0, 1, 49, 12, 5, 94, 4, 0, 49, 106, 5, 4, 32, 121, 5, 3, 0, 1, 2, 72, 0, 119, 0, 105, 2, 134, 6, 0, 0, 172, 245, 0, 0, 0, 3, 0, 0, 34, 49, 6, 0, 121, 49, 3, 0, 1, 2, 4, 0, 119, 0, 98, 2, 106, 49, 0, 28, 106, 48, 3, 32, 41, 48, 48, 2, 94, 7, 49, 48, 1, 49, 184, 2, 94, 8, 7, 49, 106, 49, 8, 40, 120, 49, 3, 0, 1, 9, 0, 0, 119, 0, 64, 0, 106, 48, 8, 16, 135, 49, 180, 0, 48, 0, 0, 0, 121, 49, 16, 0, 1, 48, 48, 0, 2, 50, 0, 0, 124, 107, 11, 0, 25, 51, 3, 72, 135, 49, 5, 0, 0, 48, 50, 51, 1, 51, 184, 2, 94, 51, 7, 51, 106, 51, 51, 16, 135, 49, 14, 0, 51, 0, 0, 0, 1, 49, 180, 0, 94, 49, 7, 49, 1, 51, 0, 0, 109, 49, 60, 51, 94, 8, 7, 46, 120, 8, 3, 0, 3, 10, 7, 43, 119, 0, 16, 0, 1, 51, 184, 2, 94, 51, 7, 51, 106, 51, 51, 16, 106, 51, 51, 16, 94, 49, 7, 43, 106, 49, 49, 4, 45, 51, 51, 49, 92, 6, 1, 0, 3, 10, 7, 43, 119, 0, 6, 0, 135, 51, 116, 0, 8, 0, 0, 0, 1, 49, 0, 0, 97, 7, 46, 49, 3, 10, 7, 43, 1, 49, 184, 2, 94, 49, 7, 49, 106, 49, 49, 16, 82, 51, 10, 0, 135, 8, 83, 0, 49, 51, 0, 0, 34, 51, 8, 0, 121, 51, 4, 0, 0, 11, 8, 0, 1, 2, 69, 0, 119, 0, 39, 2, 106, 51, 7, 8, 82, 49, 10, 0, 135, 8, 83, 0, 51, 49, 0, 0, 34, 49, 8, 0, 121, 49, 4, 0, 0, 11, 8, 0, 1, 2, 69, 0, 119, 0, 30, 2, 1, 49, 184, 2, 94, 49, 7, 49, 1, 51, 0, 0, 109, 49, 40, 51, 0, 9, 8, 0, 106, 8, 3, 8, 25, 51, 3, 8, 106, 12, 51, 4, 32, 51, 8, 0, 2, 49, 0, 0, 0, 0, 0, 128, 13, 49, 12, 49, 19, 51, 51, 49, 120, 51, 91, 0, 106, 13, 3, 16, 25, 51, 3, 16, 106, 14, 51, 4, 33, 51, 13, 0, 2, 49, 0, 0, 0, 0, 0, 128, 14, 49, 14, 49, 20, 51, 51, 49, 15, 49, 12, 14, 13, 50, 12, 14, 16, 48, 8, 13, 19, 50, 50, 48, 20, 49, 49, 50, 19, 51, 51, 49, 121, 51, 76, 0, 106, 13, 3, 32, 1, 51, 184, 1, 3, 15, 3, 51, 25, 16, 15, 32, 1, 51, 0, 0, 83, 15, 51, 0, 25, 15, 15, 1, 54, 51, 15, 16, 68, 7, 1, 0, 109, 3, 80, 8, 25, 51, 3, 80, 109, 51, 4, 12, 1, 49, 184, 1, 3, 49, 3, 49, 1, 50, 32, 0, 2, 48, 0, 0, 150, 27, 13, 0, 25, 52, 3, 80, 135, 51, 10, 0, 49, 50, 48, 52, 1, 51, 152, 1, 3, 15, 3, 51, 25, 16, 15, 32, 1, 51, 0, 0, 83, 15, 51, 0, 25, 15, 15, 1, 54, 51, 15, 16, 144, 7, 1, 0, 106, 12, 3, 16, 25, 51, 3, 16, 106, 8, 51, 4, 32, 51, 12, 0, 2, 52, 0, 0, 0, 0, 0, 128, 13, 52, 8, 52, 19, 51, 51, 52, 121, 51, 10, 0, 1, 52, 152, 1, 3, 52, 3, 52, 1, 48, 32, 0, 2, 50, 0, 0, 201, 107, 11, 0, 25, 49, 3, 88, 135, 51, 10, 0, 52, 48, 50, 49, 119, 0, 12, 0, 109, 3, 96, 12, 25, 51, 3, 96, 109, 51, 4, 8, 1, 49, 152, 1, 3, 49, 3, 49, 1, 50, 32, 0, 2, 48, 0, 0, 150, 27, 13, 0, 25, 52, 3, 96, 135, 51, 10, 0, 49, 50, 48, 52, 106, 8, 3, 28, 109, 3, 104, 13, 25, 51, 3, 104, 1, 52, 184, 1, 3, 52, 3, 52, 109, 51, 4, 52, 25, 52, 3, 104, 1, 51, 152, 1, 3, 51, 3, 51, 109, 52, 8, 51, 25, 51, 3, 104, 109, 51, 12, 8, 1, 52, 24, 0, 2, 48, 0, 0, 207, 107, 11, 0, 25, 50, 3, 104, 135, 51, 5, 0, 0, 52, 48, 50, 1, 51, 168, 4, 94, 51, 0, 51, 38, 51, 51, 1, 121, 51, 118, 0, 106, 8, 3, 32, 1, 51, 120, 1, 3, 15, 3, 51, 25, 16, 15, 32, 1, 51, 0, 0, 83, 15, 51, 0, 25, 15, 15, 1, 54, 51, 15, 16, 128, 8, 1, 0, 106, 13, 3, 8, 25, 51, 3, 8, 106, 12, 51, 4, 32, 51, 13, 0, 2, 50, 0, 0, 0, 0, 0, 128, 13, 50, 12, 50, 19, 51, 51, 50, 121, 51, 10, 0, 1, 50, 120, 1, 3, 50, 3, 50, 1, 48, 32, 0, 2, 52, 0, 0, 201, 107, 11, 0, 25, 49, 3, 120, 135, 51, 10, 0, 50, 48, 52, 49, 119, 0, 15, 0, 1, 51, 128, 0, 97, 3, 51, 13, 1, 51, 128, 0, 3, 51, 3, 51, 109, 51, 4, 12, 1, 49, 120, 1, 3, 49, 3, 49, 1, 52, 32, 0, 2, 48, 0, 0, 150, 27, 13, 0, 1, 50, 128, 0, 3, 50, 3, 50, 135, 51, 10, 0, 49, 52, 48, 50, 1, 51, 88, 1, 3, 15, 3, 51, 25, 16, 15, 32, 1, 51, 0, 0, 83, 15, 51, 0, 25, 15, 15, 1, 54, 51, 15, 16, 32, 9, 1, 0, 106, 12, 3, 16, 25, 51, 3, 16, 106, 13, 51, 4, 32, 51, 12, 0, 2, 50, 0, 0, 0, 0, 0, 128, 13, 50, 13, 50, 19, 51, 51, 50, 121, 51, 11, 0, 1, 50, 88, 1, 3, 50, 3, 50, 1, 48, 32, 0, 2, 52, 0, 0, 201, 107, 11, 0, 1, 49, 136, 0, 3, 49, 3, 49, 135, 51, 10, 0, 50, 48, 52, 49, 119, 0, 15, 0, 1, 51, 144, 0, 97, 3, 51, 12, 1, 51, 144, 0, 3, 51, 3, 51, 109, 51, 4, 13, 1, 49, 88, 1, 3, 49, 3, 49, 1, 52, 32, 0, 2, 48, 0, 0, 150, 27, 13, 0, 1, 50, 144, 0, 3, 50, 3, 50, 135, 51, 10, 0, 49, 52, 48, 50, 106, 13, 3, 28, 106, 12, 3, 48, 25, 51, 3, 48, 106, 14, 51, 4, 106, 17, 3, 36, 1, 51, 152, 0, 97, 3, 51, 8, 1, 51, 152, 0, 3, 51, 3, 51, 1, 50, 120, 1, 3, 50, 3, 50, 109, 51, 4, 50, 1, 50, 152, 0, 3, 50, 3, 50, 1, 51, 88, 1, 3, 51, 3, 51, 109, 50, 8, 51, 1, 51, 152, 0, 3, 51, 3, 51, 109, 51, 12, 13, 1, 51, 152, 0, 3, 51, 3, 51, 25, 13, 51, 16, 85, 13, 12, 0, 109, 13, 4, 14, 1, 51, 152, 0, 3, 51, 3, 51, 109, 51, 24, 17, 1, 50, 48, 0, 2, 48, 0, 0, 6, 108, 11, 0, 1, 52, 152, 0, 3, 52, 3, 52, 135, 51, 5, 0, 0, 50, 48, 52, 94, 51, 7, 45, 120, 51, 3, 0, 1, 2, 44, 0, 119, 0, 100, 0, 94, 51, 7, 46, 120, 51, 53, 0, 1, 51, 72, 4, 94, 51, 0, 51, 38, 51, 51, 32, 121, 51, 3, 0, 1, 2, 44, 0, 119, 0, 92, 0, 94, 51, 7, 43, 106, 51, 51, 4, 135, 17, 82, 0, 51, 0, 0, 0, 97, 7, 46, 17, 120, 17, 16, 0, 94, 51, 7, 43, 106, 51, 51, 4, 135, 14, 9, 0, 51, 0, 0, 0, 97, 3, 44, 14, 1, 52, 40, 0, 2, 48, 0, 0, 82, 108, 11, 0, 3, 50, 3, 44, 135, 51, 5, 0, 0, 52, 48, 50, 1, 50, 0, 0, 97, 7, 45, 50, 1, 2, 44, 0, 119, 0, 71, 0, 94, 50, 7, 45, 1, 48, 0, 0, 1, 51, 6, 0, 138, 50, 48, 51, 244, 10, 1, 0, 240, 10, 1, 0, 252, 10, 1, 0, 240, 10, 1, 0, 12, 11, 1, 0, 28, 11, 1, 0, 119, 0, 15, 0, 1, 2, 44, 0, 119, 0, 58, 0, 94, 48, 17, 43, 39, 48, 48, 1, 97, 17, 43, 48, 119, 0, 9, 0, 94, 51, 17, 43, 39, 51, 51, 2, 97, 17, 43, 51, 119, 0, 5, 0, 94, 48, 17, 43, 20, 48, 48, 47, 97, 17, 43, 48, 119, 0, 1, 0, 1, 50, 48, 0, 106, 48, 7, 52, 49, 50, 50, 48, 80, 11, 1, 0, 135, 50, 60, 0, 3, 0, 0, 0, 1, 18, 0, 0, 0, 19, 9, 0, 119, 0, 37, 0, 106, 50, 3, 32, 135, 17, 181, 0, 0, 3, 50, 0, 34, 50, 17, 0, 121, 50, 4, 0, 0, 11, 17, 0, 1, 2, 69, 0, 119, 0, 242, 0, 1, 50, 184, 2, 94, 50, 7, 50, 106, 14, 50, 16, 94, 13, 7, 43, 1, 48, 88, 1, 94, 48, 14, 48, 109, 13, 108, 48, 25, 48, 14, 40, 106, 12, 48, 4, 106, 50, 14, 40, 109, 13, 24, 50, 25, 50, 13, 24, 109, 50, 4, 12, 1, 48, 92, 1, 94, 48, 14, 48, 109, 13, 104, 48, 1, 48, 120, 1, 3, 48, 14, 48, 106, 12, 48, 4, 1, 50, 120, 1, 94, 50, 14, 50, 109, 13, 96, 50, 25, 50, 13, 96, 109, 50, 4, 12, 106, 48, 14, 16, 109, 13, 4, 48, 1, 18, 0, 0, 0, 19, 17, 0, 32, 48, 2, 44, 121, 48, 181, 0, 1, 2, 0, 0, 0, 15, 1, 0, 0, 20, 3, 0, 25, 16, 15, 72, 116, 15, 20, 0, 25, 15, 15, 4, 25, 20, 20, 4, 54, 48, 15, 16, 248, 11, 1, 0, 1, 50, 0, 0, 1, 51, 0, 0, 2, 52, 0, 0, 0, 0, 0, 128, 1, 49, 0, 0, 2, 53, 0, 0, 0, 0, 0, 128, 135, 48, 182, 0, 0, 7, 50, 1, 51, 52, 49, 53, 106, 48, 0, 4, 106, 48, 48, 8, 1, 53, 0, 1, 19, 48, 48, 53, 120, 48, 4, 0, 1, 18, 1, 0, 0, 19, 9, 0, 119, 0, 154, 0, 106, 48, 1, 36, 38, 48, 48, 1, 120, 48, 4, 0, 1, 18, 1, 0, 0, 19, 9, 0, 119, 0, 148, 0, 106, 8, 1, 16, 25, 48, 1, 16, 106, 17, 48, 4, 32, 48, 8, 0, 2, 53, 0, 0, 0, 0, 0, 128, 13, 53, 17, 53, 19, 48, 48, 53, 121, 48, 4, 0, 1, 18, 1, 0, 0, 19, 9, 0, 119, 0, 136, 0, 106, 48, 0, 28, 82, 53, 7, 0, 41, 53, 53, 2, 94, 14, 48, 53, 1, 48, 140, 1, 94, 13, 14, 48, 1, 48, 124, 4, 94, 48, 0, 48, 29, 48, 48, 24, 48, 48, 13, 48, 212, 12, 1, 0, 0, 21, 8, 0, 0, 22, 17, 0, 119, 0, 42, 0, 1, 48, 0, 0, 47, 48, 48, 13, 92, 13, 1, 0, 1, 13, 0, 0, 1, 12, 0, 0, 1, 48, 136, 1, 94, 23, 14, 48, 27, 48, 13, 24, 3, 24, 23, 48, 27, 48, 12, 24, 3, 25, 23, 48, 116, 24, 25, 0, 106, 53, 25, 4, 109, 24, 4, 53, 106, 48, 25, 8, 109, 24, 8, 48, 106, 53, 25, 12, 109, 24, 12, 53, 106, 48, 25, 16, 109, 24, 16, 48, 106, 53, 25, 20, 109, 24, 20, 53, 25, 13, 13, 1, 41, 53, 13, 1, 0, 12, 53, 0, 1, 53, 140, 1, 94, 53, 14, 53, 54, 53, 12, 53, 232, 12, 1, 0, 0, 26, 13, 0, 106, 27, 1, 16, 25, 53, 1, 16, 106, 28, 53, 4, 119, 0, 4, 0, 1, 26, 0, 0, 0, 27, 8, 0, 0, 28, 17, 0, 1, 53, 140, 1, 97, 14, 53, 26, 0, 21, 27, 0, 0, 22, 28, 0, 106, 12, 1, 56, 25, 53, 1, 56, 106, 25, 53, 4, 1, 53, 248, 1, 94, 24, 7, 53, 120, 24, 4, 0, 0, 29, 21, 0, 0, 30, 22, 0, 119, 0, 57, 0, 1, 53, 240, 1, 94, 23, 7, 53, 1, 53, 240, 1, 3, 53, 7, 53, 106, 31, 53, 4, 33, 53, 21, 0, 2, 48, 0, 0, 0, 0, 0, 128, 14, 48, 22, 48, 20, 53, 53, 48, 33, 48, 23, 0, 2, 49, 0, 0, 0, 0, 0, 128, 14, 49, 31, 49, 20, 48, 48, 49, 19, 53, 53, 48, 121, 53, 38, 0, 15, 53, 22, 31, 13, 48, 31, 22, 16, 49, 21, 23, 19, 48, 48, 49, 20, 53, 53, 48, 0, 32, 53, 0, 32, 53, 24, 1, 19, 53, 53, 32, 121, 53, 12, 0, 1, 53, 1, 0, 1, 48, 0, 0, 94, 49, 7, 44, 135, 23, 49, 0, 53, 48, 49, 0, 135, 49, 2, 0, 135, 31, 44, 0, 23, 49, 21, 22, 0, 29, 31, 0, 135, 30, 2, 0, 119, 0, 20, 0, 33, 49, 24, 255, 20, 49, 49, 32, 121, 49, 4, 0, 0, 29, 21, 0, 0, 30, 22, 0, 119, 0, 14, 0, 1, 49, 1, 0, 1, 48, 0, 0, 94, 53, 7, 44, 135, 32, 49, 0, 49, 48, 53, 0, 135, 53, 2, 0, 135, 31, 20, 0, 21, 22, 32, 53, 0, 29, 31, 0, 135, 30, 2, 0, 119, 0, 3, 0, 0, 29, 21, 0, 0, 30, 22, 0, 1, 48, 136, 1, 3, 48, 7, 48, 1, 49, 140, 1, 3, 49, 7, 49, 1, 52, 144, 1, 3, 52, 7, 52, 1, 51, 0, 0, 1, 50, 0, 0, 1, 54, 1, 0, 135, 53, 183, 0, 48, 49, 52, 12, 25, 29, 30, 51, 50, 54, 0, 0, 1, 18, 1, 0, 0, 19, 9, 0, 106, 53, 1, 36, 38, 53, 53, 1, 120, 53, 21, 0, 1, 53, 188, 1, 94, 53, 7, 53, 120, 53, 3, 0, 0, 33, 18, 0, 119, 0, 20, 0, 135, 53, 60, 0, 3, 0, 0, 0, 120, 18, 3, 0, 1, 33, 0, 0, 119, 0, 15, 0, 0, 15, 1, 0, 0, 20, 3, 0, 25, 16, 15, 72, 116, 15, 20, 0, 25, 15, 15, 4, 25, 20, 20, 4, 54, 53, 15, 16, 248, 14, 1, 0, 1, 33, 0, 0, 119, 0, 5, 0, 1, 53, 188, 1, 1, 54, 0, 0, 97, 7, 53, 54, 0, 33, 18, 0, 121, 33, 150, 253, 0, 34, 19, 0, 1, 2, 76, 0, 119, 0, 1, 0, 32, 54, 2, 4, 121, 54, 43, 0, 32, 54, 6, 245, 121, 54, 4, 0, 1, 11, 245, 255, 1, 2, 69, 0, 119, 0, 44, 0, 106, 19, 0, 24, 121, 19, 24, 0, 1, 33, 0, 0, 0, 18, 19, 0, 106, 54, 0, 28, 41, 53, 33, 2, 94, 19, 54, 53, 94, 54, 19, 46, 120, 54, 3, 0, 0, 35, 18, 0, 119, 0, 10, 0, 94, 54, 19, 45, 120, 54, 3, 0, 0, 35, 18, 0, 119, 0, 6, 0, 1, 53, 0, 0, 82, 50, 19, 0, 135, 54, 181, 0, 0, 53, 50, 0, 106, 35, 0, 24, 25, 33, 33, 1, 57, 54, 35, 33, 180, 15, 1, 0, 0, 18, 35, 0, 119, 0, 236, 255, 1, 54, 12, 5, 94, 35, 0, 54, 106, 18, 35, 32, 120, 18, 4, 0, 0, 34, 6, 0, 1, 2, 76, 0, 119, 0, 12, 0, 25, 36, 35, 32, 0, 37, 18, 0, 0, 38, 35, 0, 1, 2, 73, 0, 119, 0, 7, 0, 32, 54, 2, 72, 121, 54, 5, 0, 25, 36, 4, 32, 0, 37, 5, 0, 0, 38, 4, 0, 1, 2, 73, 0, 32, 54, 2, 69, 121, 54, 5, 0, 0, 39, 11, 0, 137, 3, 0, 0, 139, 39, 0, 0, 119, 0, 32, 0, 32, 54, 2, 73, 121, 54, 21, 0, 85, 3, 37, 0, 0, 15, 1, 0, 0, 20, 37, 0, 25, 16, 15, 72, 116, 15, 20, 0, 25, 15, 15, 4, 25, 20, 20, 4, 54, 54, 15, 16, 44, 16, 1, 0, 25, 20, 37, 72, 116, 36, 20, 0, 82, 54, 20, 0, 120, 54, 3, 0, 1, 50, 0, 0, 109, 38, 36, 50, 135, 50, 73, 0, 3, 0, 0, 0, 1, 40, 0, 0, 1, 2, 77, 0, 119, 0, 10, 0, 32, 50, 2, 76, 121, 50, 8, 0, 1, 50, 255, 255, 47, 50, 50, 34, 140, 16, 1, 0, 0, 40, 34, 0, 1, 2, 77, 0, 119, 0, 2, 0, 0, 41, 34, 0, 32, 50, 2, 77, 121, 50, 252, 0, 106, 50, 0, 28, 106, 54, 1, 32, 41, 54, 54, 2, 94, 2, 50, 54, 1, 50, 208, 1, 94, 34, 2, 50, 1, 50, 208, 1, 3, 50, 2, 50, 106, 38, 50, 4, 32, 50, 34, 0, 32, 54, 38, 0, 19, 50, 50, 54, 121, 50, 3, 0, 1, 42, 0, 0, 119, 0, 110, 0, 106, 20, 1, 8, 25, 50, 1, 8, 106, 36, 50, 4, 32, 50, 20, 0, 2, 54, 0, 0, 0, 0, 0, 128, 13, 54, 36, 54, 19, 50, 50, 54, 121, 50, 3, 0, 1, 42, 0, 0, 119, 0, 99, 0, 2, 50, 0, 0, 0, 0, 254, 127, 15, 50, 36, 50, 2, 54, 0, 0, 0, 0, 254, 127, 13, 54, 36, 54, 35, 53, 20, 0, 19, 54, 54, 53, 20, 50, 50, 54, 0, 37, 50, 0, 1, 54, 0, 0, 1, 53, 255, 255, 125, 50, 37, 54, 53, 0, 0, 0, 1, 54, 0, 0, 2, 51, 0, 0, 255, 255, 254, 127, 125, 53, 37, 54, 51, 0, 0, 0, 135, 11, 20, 0, 20, 36, 50, 53, 135, 37, 2, 0, 106, 36, 2, 20, 94, 53, 2, 43, 106, 53, 53, 108, 106, 50, 2, 16, 5, 20, 53, 50, 34, 50, 20, 0, 41, 50, 50, 31, 42, 50, 50, 31, 0, 4, 50, 0, 34, 50, 36, 0, 41, 50, 50, 31, 42, 50, 50, 31, 0, 5, 50, 0, 135, 35, 40, 0, 11, 37, 20, 4, 36, 5, 0, 0, 135, 37, 2, 0, 106, 50, 1, 48, 25, 53, 1, 48, 106, 53, 53, 4, 135, 11, 40, 0, 50, 53, 20, 4, 36, 5, 0, 0, 135, 53, 2, 0, 34, 53, 11, 0, 41, 53, 53, 31, 42, 53, 53, 31, 135, 5, 44, 0, 35, 37, 11, 53, 135, 36, 2, 0, 34, 53, 11, 1, 15, 50, 36, 38, 13, 51, 36, 38, 16, 54, 5, 34, 19, 51, 51, 54, 20, 50, 50, 51, 20, 53, 53, 50, 121, 53, 3, 0, 1, 42, 0, 0, 119, 0, 37, 0, 1, 53, 216, 1, 3, 53, 2, 53, 106, 4, 53, 4, 47, 50, 37, 4, 24, 18, 1, 0, 1, 50, 1, 0, 0, 53, 50, 0, 119, 0, 11, 0, 45, 51, 37, 4, 52, 18, 1, 0, 1, 51, 216, 1, 94, 51, 2, 51, 16, 51, 35, 51, 0, 50, 51, 0, 119, 0, 3, 0, 1, 51, 0, 0, 0, 50, 51, 0, 0, 53, 50, 0, 0, 20, 53, 0, 135, 35, 20, 0, 5, 36, 34, 38, 135, 38, 2, 0, 121, 20, 13, 0, 34, 53, 11, 0, 41, 53, 53, 31, 42, 53, 53, 31, 0, 20, 53, 0, 15, 53, 20, 38, 13, 50, 38, 20, 16, 51, 11, 35, 19, 50, 50, 51, 20, 53, 53, 50, 125, 42, 53, 11, 35, 0, 0, 0, 119, 0, 2, 0, 1, 42, 0, 0, 1, 53, 200, 1, 94, 35, 2, 53, 32, 50, 35, 0, 121, 50, 7, 0, 1, 50, 200, 1, 3, 50, 2, 50, 106, 50, 50, 4, 32, 50, 50, 0, 0, 53, 50, 0, 119, 0, 3, 0, 1, 50, 0, 0, 0, 53, 50, 0, 120, 53, 18, 0, 25, 53, 1, 8, 106, 11, 53, 4, 106, 53, 1, 8, 1, 50, 255, 255, 1, 51, 2, 0, 138, 53, 50, 51, 224, 18, 1, 0, 244, 18, 1, 0, 119, 0, 9, 0, 2, 50, 0, 0, 255, 255, 254, 127, 53, 50, 11, 50, 0, 19, 1, 0, 119, 0, 2, 0, 120, 11, 3, 0, 1, 53, 192, 1, 97, 2, 53, 35, 1, 53, 192, 1, 94, 53, 2, 53, 20, 53, 53, 42, 121, 53, 42, 0, 1, 53, 11, 0, 1, 50, 10, 0, 135, 35, 51, 0, 1, 53, 50, 0, 121, 35, 34, 0, 1, 50, 192, 1, 94, 11, 2, 50, 83, 35, 11, 0, 42, 53, 11, 8, 107, 35, 1, 53, 42, 50, 11, 16, 107, 35, 2, 50, 42, 53, 11, 24, 107, 35, 3, 53, 107, 35, 4, 42, 25, 53, 35, 4, 42, 50, 42, 8, 107, 53, 1, 50, 25, 50, 35, 4, 42, 53, 42, 16, 107, 50, 2, 53, 25, 53, 35, 4, 42, 50, 42, 24, 107, 53, 3, 50, 1, 50, 192, 0, 1, 53, 192, 1, 94, 53, 2, 53, 97, 3, 50, 53, 1, 53, 192, 0, 3, 53, 3, 53, 109, 53, 4, 42, 1, 50, 48, 0, 2, 51, 0, 0, 147, 108, 11, 0, 1, 54, 192, 0, 3, 54, 3, 54, 135, 53, 5, 0, 0, 50, 51, 54, 1, 53, 192, 1, 1, 54, 0, 0, 97, 2, 53, 54, 1, 54, 172, 2, 94, 54, 2, 54, 120, 54, 3, 0, 0, 41, 40, 0, 119, 0, 48, 0, 1, 54, 0, 0, 1, 53, 156, 0, 94, 53, 2, 53, 47, 54, 54, 53, 116, 20, 1, 0, 1, 42, 0, 0, 1, 54, 152, 0, 94, 35, 2, 54, 27, 54, 42, 12, 3, 54, 35, 54, 25, 11, 54, 8, 82, 53, 11, 0, 1, 51, 0, 0, 135, 54, 50, 0, 1, 53, 51, 0, 120, 54, 23, 0, 27, 54, 42, 12, 3, 54, 35, 54, 25, 20, 54, 4, 82, 54, 11, 0, 82, 51, 20, 0, 135, 38, 51, 0, 1, 54, 51, 0, 120, 38, 9, 0, 1, 54, 24, 0, 2, 53, 0, 0, 187, 108, 11, 0, 1, 50, 200, 0, 3, 50, 3, 50, 135, 51, 5, 0, 0, 54, 53, 50, 119, 0, 7, 0, 27, 50, 42, 12, 94, 50, 35, 50, 82, 53, 20, 0, 135, 51, 52, 0, 38, 50, 53, 0, 119, 0, 1, 0, 25, 42, 42, 1, 1, 51, 156, 0, 94, 51, 2, 51, 54, 51, 42, 51, 224, 19, 1, 0, 1, 51, 172, 2, 1, 53, 0, 0, 97, 2, 51, 53, 0, 41, 40, 0, 2, 51, 0, 0, 222, 108, 11, 0, 1, 50, 1, 0, 1, 54, 16, 1, 3, 54, 3, 54, 135, 53, 184, 0, 0, 51, 50, 54, 1, 53, 16, 1, 94, 40, 3, 53, 121, 40, 21, 0, 1, 53, 188, 4, 1, 54, 188, 4, 94, 54, 0, 54, 39, 54, 54, 1, 97, 0, 53, 54, 1, 53, 140, 4, 3, 53, 0, 53, 1, 50, 0, 0, 135, 54, 185, 0, 53, 40, 50, 0, 1, 50, 16, 1, 3, 50, 3, 50, 135, 54, 79, 0, 50, 0, 0, 0, 2, 50, 0, 0, 222, 108, 11, 0, 1, 53, 0, 0, 1, 51, 1, 0, 135, 54, 186, 0, 0, 50, 53, 51, 135, 54, 187, 0, 0, 0, 0, 0, 1, 54, 168, 4, 94, 54, 0, 54, 38, 54, 54, 1, 120, 54, 4, 0, 0, 39, 41, 0, 137, 3, 0, 0, 139, 39, 0, 0, 106, 40, 1, 32, 1, 54, 56, 1, 3, 15, 3, 54, 25, 16, 15, 32, 1, 54, 0, 0, 83, 15, 54, 0, 25, 15, 15, 1, 54, 54, 15, 16, 48, 21, 1, 0, 106, 2, 1, 8, 25, 54, 1, 8, 106, 42, 54, 4, 32, 54, 2, 0, 2, 51, 0, 0, 0, 0, 0, 128, 13, 51, 42, 51, 19, 54, 54, 51, 121, 54, 11, 0, 1, 51, 56, 1, 3, 51, 3, 51, 1, 53, 32, 0, 2, 50, 0, 0, 201, 107, 11, 0, 1, 52, 208, 0, 3, 52, 3, 52, 135, 54, 10, 0, 51, 53, 50, 52, 119, 0, 15, 0, 1, 54, 216, 0, 97, 3, 54, 2, 1, 54, 216, 0, 3, 54, 3, 54, 109, 54, 4, 42, 1, 52, 56, 1, 3, 52, 3, 52, 1, 50, 32, 0, 2, 53, 0, 0, 150, 27, 13, 0, 1, 51, 216, 0, 3, 51, 3, 51, 135, 54, 10, 0, 52, 50, 53, 51, 1, 54, 24, 1, 3, 15, 3, 54, 25, 16, 15, 32, 1, 54, 0, 0, 83, 15, 54, 0, 25, 15, 15, 1, 54, 54, 15, 16, 212, 21, 1, 0, 106, 15, 1, 16, 25, 54, 1, 16, 106, 16, 54, 4, 32, 54, 15, 0, 2, 51, 0, 0, 0, 0, 0, 128, 13, 51, 16, 51, 19, 54, 54, 51, 121, 54, 11, 0, 1, 51, 24, 1, 3, 51, 3, 51, 1, 53, 32, 0, 2, 50, 0, 0, 201, 107, 11, 0, 1, 52, 224, 0, 3, 52, 3, 52, 135, 54, 10, 0, 51, 53, 50, 52, 119, 0, 12, 0, 97, 3, 46, 15, 3, 54, 3, 46, 109, 54, 4, 16, 1, 52, 24, 1, 3, 52, 3, 52, 1, 50, 32, 0, 2, 53, 0, 0, 150, 27, 13, 0, 3, 51, 3, 46, 135, 54, 10, 0, 52, 50, 53, 51, 106, 16, 1, 28, 106, 15, 1, 48, 25, 54, 1, 48, 106, 42, 54, 4, 106, 2, 1, 36, 1, 54, 240, 0, 97, 3, 54, 40, 1, 54, 240, 0, 3, 54, 3, 54, 1, 51, 56, 1, 3, 51, 3, 51, 109, 54, 4, 51, 1, 51, 240, 0, 3, 51, 3, 51, 1, 54, 24, 1, 3, 54, 3, 54, 109, 51, 8, 54, 1, 54, 240, 0, 3, 54, 3, 54, 109, 54, 12, 16, 1, 54, 240, 0, 3, 54, 3, 54, 25, 16, 54, 16, 85, 16, 15, 0, 109, 16, 4, 42, 1, 54, 240, 0, 3, 54, 3, 54, 109, 54, 24, 2, 1, 51, 48, 0, 2, 53, 0, 0, 231, 108, 11, 0, 1, 50, 240, 0, 3, 50, 3, 50, 135, 54, 5, 0, 0, 51, 53, 50, 0, 39, 41, 0, 137, 3, 0, 0, 139, 39, 0, 0, 140, 2, 48, 0, 0, 0, 0, 0, 2, 37, 0, 0, 0, 0, 0, 128, 2, 38, 0, 0, 12, 5, 0, 0, 2, 39, 0, 0, 184, 0, 0, 0, 2, 40, 0, 0, 240, 1, 0, 0, 1, 2, 0, 0, 136, 41, 0, 0, 0, 3, 41, 0, 136, 41, 0, 0, 25, 41, 41, 16, 137, 41, 0, 0, 1, 41, 72, 4, 94, 41, 0, 41, 38, 41, 41, 1, 120, 41, 35, 0, 94, 4, 0, 38, 106, 5, 4, 4, 120, 5, 12, 0, 134, 6, 0, 0, 28, 5, 1, 0, 0, 1, 0, 0, 34, 41, 6, 0, 121, 41, 3, 0, 0, 7, 6, 0, 119, 0, 3, 0, 0, 8, 6, 0, 119, 0, 44, 1, 137, 3, 0, 0, 139, 7, 0, 0, 109, 3, 12, 5, 0, 9, 1, 0, 0, 10, 5, 0, 25, 11, 9, 72, 116, 9, 10, 0, 25, 9, 9, 4, 25, 10, 10, 4, 54, 41, 9, 11, 144, 23, 1, 0, 106, 42, 5, 72, 109, 4, 4, 42, 106, 42, 5, 72, 120, 42, 3, 0, 1, 41, 0, 0, 109, 4, 8, 41, 25, 42, 3, 12, 135, 41, 73, 0, 42, 0, 0, 0, 1, 8, 0, 0, 119, 0, 22, 1, 1, 6, 0, 0, 1, 12, 0, 0, 94, 13, 0, 38, 106, 14, 13, 4, 120, 14, 3, 0, 1, 15, 0, 0, 119, 0, 161, 0, 106, 16, 14, 16, 25, 41, 14, 16, 106, 17, 41, 4, 32, 41, 16, 0, 13, 42, 17, 37], eb + 61440);
                HEAPU8.set([19, 41, 41, 42, 121, 41, 5, 0, 25, 18, 14, 8, 0, 19, 13, 0, 0, 20, 14, 0, 119, 0, 116, 0, 1, 41, 2, 0, 1, 42, 0, 0, 106, 43, 0, 28, 106, 44, 14, 32, 41, 44, 44, 2, 94, 43, 43, 44, 94, 43, 43, 39, 26, 43, 43, 1, 135, 13, 49, 0, 41, 42, 43, 0, 135, 21, 2, 0, 0, 22, 14, 0, 0, 23, 16, 0, 0, 16, 17, 0, 106, 42, 14, 8, 32, 42, 42, 0, 121, 42, 6, 0, 25, 42, 14, 8, 106, 42, 42, 4, 13, 42, 42, 37, 0, 43, 42, 0, 119, 0, 3, 0, 1, 42, 0, 0, 0, 43, 42, 0, 120, 43, 4, 0, 0, 24, 23, 0, 0, 25, 16, 0, 119, 0, 59, 0, 106, 43, 22, 32, 106, 42, 14, 32, 45, 43, 43, 42, 72, 25, 1, 0, 25, 17, 22, 16, 106, 42, 14, 16, 25, 41, 14, 16, 106, 41, 41, 4, 82, 44, 17, 0, 106, 45, 17, 4, 135, 43, 188, 0, 42, 41, 44, 45, 13, 21, 0, 0, 135, 43, 2, 0, 34, 43, 43, 0, 121, 43, 30, 0, 25, 26, 22, 8, 82, 43, 26, 0, 106, 45, 26, 4, 82, 44, 17, 0, 106, 41, 17, 4, 135, 27, 188, 0, 43, 45, 44, 41, 13, 21, 0, 0, 32, 41, 27, 0, 135, 44, 2, 0, 32, 44, 44, 0, 19, 41, 41, 44, 120, 41, 6, 0, 106, 27, 17, 4, 82, 44, 17, 0, 109, 14, 8, 44, 25, 44, 14, 8, 109, 44, 4, 27, 32, 44, 23, 0, 13, 41, 16, 37, 19, 44, 44, 41, 121, 44, 5, 0, 1, 28, 0, 0, 2, 29, 0, 0, 0, 0, 0, 128, 119, 0, 9, 0, 82, 28, 17, 0, 106, 29, 17, 4, 119, 0, 6, 0, 0, 28, 23, 0, 0, 29, 16, 0, 119, 0, 3, 0, 0, 28, 23, 0, 0, 29, 16, 0, 106, 22, 22, 72, 120, 22, 4, 0, 0, 24, 28, 0, 0, 25, 29, 0, 119, 0, 4, 0, 0, 23, 28, 0, 0, 16, 29, 0, 119, 0, 185, 255, 121, 12, 25, 0, 33, 44, 24, 0, 14, 41, 25, 37, 20, 44, 44, 41, 106, 45, 14, 8, 32, 45, 45, 0, 121, 45, 6, 0, 25, 45, 14, 8, 106, 45, 45, 4, 13, 45, 45, 37, 0, 41, 45, 0, 119, 0, 3, 0, 1, 45, 0, 0, 0, 41, 45, 0, 19, 44, 44, 41, 121, 44, 10, 0, 106, 44, 14, 48, 25, 41, 14, 48, 106, 41, 41, 4, 135, 16, 44, 0, 44, 41, 24, 25, 135, 23, 2, 0, 109, 14, 8, 16, 25, 41, 14, 8, 109, 41, 4, 23, 94, 23, 0, 38, 25, 18, 14, 8, 0, 19, 23, 0, 106, 20, 23, 4, 0, 23, 18, 0, 82, 44, 23, 0, 32, 44, 44, 0, 121, 44, 5, 0, 106, 44, 23, 4, 13, 44, 44, 37, 0, 41, 44, 0, 119, 0, 3, 0, 1, 44, 0, 0, 0, 41, 44, 0, 120, 41, 2, 0, 119, 0, 92, 0, 1, 41, 48, 0, 106, 44, 0, 28, 106, 45, 14, 32, 41, 45, 45, 2, 94, 44, 44, 45, 106, 44, 44, 52, 56, 41, 41, 44, 128, 27, 1, 0, 33, 41, 12, 0, 106, 45, 14, 16, 32, 45, 45, 0, 121, 45, 6, 0, 25, 45, 14, 16, 106, 45, 45, 4, 13, 45, 45, 37, 0, 44, 45, 0, 119, 0, 3, 0, 1, 45, 0, 0, 0, 44, 45, 0, 20, 41, 41, 44, 120, 41, 71, 0, 0, 15, 20, 0, 134, 23, 0, 0, 28, 5, 1, 0, 0, 1, 0, 0, 34, 41, 23, 0, 121, 41, 15, 0, 33, 41, 15, 0, 33, 44, 23, 245, 19, 41, 41, 44, 0, 16, 41, 0, 1, 41, 4, 0, 1, 44, 1, 0, 125, 30, 16, 41, 44, 0, 0, 0, 125, 31, 16, 6, 23, 0, 0, 0, 1, 44, 1, 0, 125, 32, 16, 44, 12, 0, 0, 0, 119, 0, 34, 0, 94, 16, 0, 38, 1, 44, 80, 0, 135, 22, 93, 0, 44, 0, 0, 0, 120, 22, 3, 0, 1, 33, 244, 255, 119, 0, 22, 0, 135, 21, 100, 0, 22, 1, 0, 0, 34, 44, 21, 0, 121, 44, 5, 0, 135, 44, 170, 0, 22, 0, 0, 0, 0, 33, 21, 0, 119, 0, 14, 0, 106, 44, 16, 4, 120, 44, 3, 0, 109, 16, 4, 22, 119, 0, 3, 0, 106, 44, 16, 8, 109, 44, 72, 22, 109, 16, 8, 22, 135, 44, 60, 0, 1, 0, 0, 0, 1, 30, 0, 0, 0, 31, 6, 0, 0, 32, 12, 0, 119, 0, 6, 0, 135, 44, 60, 0, 1, 0, 0, 0, 1, 30, 1, 0, 0, 31, 33, 0, 0, 32, 12, 0, 38, 44, 30, 7, 1, 41, 0, 0, 1, 45, 5, 0, 138, 44, 41, 45, 108, 27, 1, 0, 96, 27, 1, 0, 96, 27, 1, 0, 96, 27, 1, 0, 112, 27, 1, 0, 0, 7, 31, 0, 1, 2, 62, 0, 119, 0, 6, 0, 119, 0, 2, 0, 119, 0, 1, 0, 0, 6, 31, 0, 0, 12, 32, 0, 119, 0, 23, 255, 32, 44, 2, 62, 121, 44, 3, 0, 137, 3, 0, 0, 139, 7, 0, 0, 25, 12, 19, 8, 120, 20, 16, 0, 2, 44, 0, 0, 69, 107, 11, 0, 85, 3, 44, 0, 2, 41, 0, 0, 169, 103, 11, 0, 109, 3, 4, 41, 1, 44, 19, 6, 109, 3, 8, 44, 1, 41, 0, 0, 1, 45, 0, 0, 2, 43, 0, 0, 102, 48, 13, 0, 135, 44, 5, 0, 41, 45, 43, 3, 135, 44, 62, 0, 25, 6, 19, 4, 109, 3, 12, 20, 0, 9, 1, 0, 0, 10, 20, 0, 25, 11, 9, 72, 116, 9, 10, 0, 25, 9, 9, 4, 25, 10, 10, 4, 54, 44, 9, 11, 232, 27, 1, 0, 25, 4, 20, 72, 116, 6, 4, 0, 82, 44, 4, 0, 120, 44, 3, 0, 1, 44, 0, 0, 85, 12, 44, 0, 25, 43, 3, 12, 135, 44, 73, 0, 43, 0, 0, 0, 1, 8, 0, 0, 106, 20, 0, 28, 106, 44, 1, 32, 41, 44, 44, 2, 94, 10, 20, 44, 106, 44, 0, 4, 106, 44, 44, 8, 1, 43, 0, 1, 19, 44, 44, 43, 121, 44, 129, 0, 106, 44, 1, 36, 38, 44, 44, 1, 121, 44, 126, 0, 82, 44, 10, 0, 41, 44, 44, 2, 94, 9, 20, 44, 1, 44, 140, 1, 94, 20, 9, 44, 1, 44, 124, 4, 94, 44, 0, 44, 29, 44, 44, 24, 50, 44, 44, 20, 12, 29, 1, 0, 1, 44, 0, 0, 47, 44, 44, 20, 0, 29, 1, 0, 1, 20, 0, 0, 1, 0, 0, 0, 1, 44, 136, 1, 94, 11, 9, 44, 27, 44, 20, 24, 3, 19, 11, 44, 27, 44, 0, 24, 3, 2, 11, 44, 116, 19, 2, 0, 106, 43, 2, 4, 109, 19, 4, 43, 106, 44, 2, 8, 109, 19, 8, 44, 106, 43, 2, 12, 109, 19, 12, 43, 106, 44, 2, 16, 109, 19, 16, 44, 106, 43, 2, 20, 109, 19, 20, 43, 25, 2, 20, 1, 41, 43, 2, 1, 0, 0, 43, 0, 1, 43, 140, 1, 94, 43, 9, 43, 49, 43, 43, 0, 248, 28, 1, 0, 0, 34, 2, 0, 119, 0, 4, 0, 0, 20, 2, 0, 119, 0, 229, 255, 1, 34, 0, 0, 1, 43, 140, 1, 97, 9, 43, 34, 106, 34, 1, 56, 25, 43, 1, 56, 106, 9, 43, 4, 106, 20, 1, 16, 25, 43, 1, 16, 106, 0, 43, 4, 1, 43, 248, 1, 94, 2, 10, 43, 120, 2, 4, 0, 0, 35, 20, 0, 0, 36, 0, 0, 119, 0, 55, 0, 94, 19, 10, 40, 3, 43, 10, 40, 106, 11, 43, 4, 33, 43, 20, 0, 14, 44, 0, 37, 20, 43, 43, 44, 33, 44, 19, 0, 14, 45, 11, 37, 20, 44, 44, 45, 19, 43, 43, 44, 121, 43, 42, 0, 32, 43, 2, 1, 15, 44, 0, 11, 13, 45, 11, 0, 16, 41, 20, 19, 19, 45, 45, 41, 20, 44, 44, 45, 19, 43, 43, 44, 121, 43, 12, 0, 1, 43, 1, 0, 1, 44, 0, 0, 94, 45, 10, 39, 135, 32, 49, 0, 43, 44, 45, 0, 135, 45, 2, 0, 135, 31, 44, 0, 32, 45, 20, 0, 0, 35, 31, 0, 135, 36, 2, 0, 119, 0, 25, 0, 33, 45, 2, 255, 15, 44, 0, 11, 13, 43, 11, 0, 16, 41, 20, 19, 19, 43, 43, 41, 20, 44, 44, 43, 20, 45, 45, 44, 121, 45, 4, 0, 0, 35, 20, 0, 0, 36, 0, 0, 119, 0, 14, 0, 1, 45, 1, 0, 1, 44, 0, 0, 94, 43, 10, 39, 135, 19, 49, 0, 45, 44, 43, 0, 135, 43, 2, 0, 135, 11, 20, 0, 20, 0, 19, 43, 0, 35, 11, 0, 135, 36, 2, 0, 119, 0, 3, 0, 0, 35, 20, 0, 0, 36, 0, 0, 1, 44, 136, 1, 3, 44, 10, 44, 1, 45, 140, 1, 3, 45, 10, 45, 1, 41, 144, 1, 3, 41, 10, 41, 1, 42, 0, 0, 1, 46, 0, 0, 1, 47, 1, 0, 135, 43, 183, 0, 44, 45, 41, 34, 9, 35, 36, 42, 46, 47, 0, 0, 106, 36, 1, 16, 25, 43, 1, 16, 106, 35, 43, 4, 2, 43, 0, 0, 0, 0, 254, 127, 15, 43, 35, 43, 2, 47, 0, 0, 0, 0, 254, 127, 13, 47, 35, 47, 35, 46, 36, 0, 19, 47, 47, 46, 20, 43, 43, 47, 120, 43, 10, 0, 1, 43, 1, 0, 2, 47, 0, 0, 0, 0, 1, 128, 135, 9, 44, 0, 36, 35, 43, 47, 135, 35, 2, 0, 109, 1, 16, 9, 25, 47, 1, 16, 109, 47, 4, 35, 106, 35, 1, 8, 25, 47, 1, 8, 106, 9, 47, 4, 2, 47, 0, 0, 0, 0, 254, 127, 15, 47, 9, 47, 2, 43, 0, 0, 0, 0, 254, 127, 13, 43, 9, 43, 35, 46, 35, 0, 19, 43, 43, 46, 20, 47, 47, 43, 121, 47, 4, 0, 0, 7, 8, 0, 137, 3, 0, 0, 139, 7, 0, 0, 1, 47, 1, 0, 2, 43, 0, 0, 0, 0, 1, 128, 135, 36, 44, 0, 35, 9, 47, 43, 135, 9, 2, 0, 109, 1, 8, 36, 25, 43, 1, 8, 109, 43, 4, 9, 0, 7, 8, 0, 137, 3, 0, 0, 139, 7, 0, 0, 140, 4, 27, 0, 0, 0, 0, 0, 2, 20, 0, 0, 84, 105, 11, 0, 2, 21, 0, 0, 151, 147, 12, 0, 2, 22, 0, 0, 95, 252, 11, 0, 1, 4, 0, 0, 136, 23, 0, 0, 0, 5, 23, 0, 136, 23, 0, 0, 25, 23, 23, 64, 137, 23, 0, 0, 82, 6, 0, 0, 1, 24, 0, 0, 109, 5, 40, 24, 1, 23, 0, 0, 109, 5, 36, 23, 120, 6, 9, 0, 135, 7, 125, 0, 120, 7, 5, 0, 1, 8, 244, 255, 137, 5, 0, 0, 139, 8, 0, 0, 119, 0, 4, 0, 0, 9, 7, 0, 119, 0, 2, 0, 0, 9, 6, 0, 82, 23, 9, 0, 120, 23, 10, 0, 1, 24, 0, 0, 1, 25, 16, 0, 2, 26, 0, 0, 101, 104, 11, 0, 135, 23, 5, 0, 24, 25, 26, 5, 1, 8, 234, 255, 137, 5, 0, 0, 139, 8, 0, 0, 121, 2, 2, 0, 109, 9, 4, 2, 121, 3, 6, 0, 25, 26, 5, 40, 82, 25, 3, 0, 1, 24, 0, 0, 135, 23, 185, 0, 26, 25, 24, 0, 25, 2, 9, 16, 82, 23, 2, 0, 121, 23, 7, 0, 1, 23, 72, 4, 3, 6, 9, 23, 82, 23, 6, 0, 1, 24, 128, 0, 20, 23, 23, 24, 85, 6, 23, 0, 25, 23, 5, 40, 135, 6, 189, 0, 9, 23, 0, 0, 34, 23, 6, 0, 121, 23, 3, 0, 0, 10, 6, 0, 119, 0, 151, 1, 32, 23, 1, 0, 2, 24, 0, 0, 218, 192, 65, 0, 125, 7, 23, 24, 1, 0, 0, 0, 135, 11, 143, 0, 7, 0, 0, 0, 1, 24, 32, 4, 97, 9, 24, 11, 120, 11, 3, 0, 1, 10, 244, 255, 119, 0, 139, 1, 25, 23, 9, 32, 1, 25, 0, 4, 135, 24, 175, 0, 23, 7, 25, 0, 109, 5, 48, 1, 25, 24, 5, 48, 1, 25, 0, 0, 109, 24, 4, 25, 25, 25, 5, 48, 1, 24, 0, 0, 109, 25, 8, 24, 25, 24, 5, 48, 1, 25, 0, 0, 109, 24, 12, 25, 1, 24, 25, 0, 109, 5, 44, 24, 82, 7, 2, 0, 120, 7, 48, 0, 25, 11, 9, 4, 82, 12, 11, 0, 120, 12, 11, 0, 25, 24, 5, 48, 1, 25, 0, 0, 25, 23, 5, 44, 135, 13, 190, 0, 24, 25, 23, 0, 85, 11, 13, 0, 121, 13, 10, 0, 106, 14, 5, 44, 1, 4, 27, 0, 119, 0, 66, 0, 106, 23, 12, 8, 38, 23, 23, 1, 121, 23, 4, 0, 1, 15, 25, 0, 1, 4, 26, 0, 119, 0, 60, 0, 1, 23, 72, 5, 94, 23, 9, 23, 38, 23, 23, 127, 1, 25, 220, 4, 94, 25, 9, 25, 39, 25, 25, 1, 25, 24, 5, 40, 135, 12, 191, 0, 23, 9, 2, 1, 25, 24, 0, 0, 34, 23, 12, 0, 121, 23, 3, 0, 0, 10, 12, 0, 119, 0, 88, 1, 82, 23, 11, 0, 120, 23, 10, 0, 82, 23, 2, 0, 1, 24, 0, 0, 1, 25, 0, 5, 94, 25, 9, 25, 135, 14, 192, 0, 23, 11, 1, 9, 24, 25, 0, 0, 1, 4, 27, 0, 119, 0, 35, 0, 1, 15, 0, 0, 1, 4, 26, 0, 119, 0, 32, 0, 1, 25, 72, 4, 3, 11, 9, 25, 82, 25, 11, 0, 1, 24, 128, 0, 20, 25, 25, 24, 85, 11, 25, 0, 25, 11, 9, 4, 82, 12, 11, 0, 120, 12, 9, 0, 1, 25, 0, 0, 1, 24, 0, 5, 94, 24, 9, 24, 135, 14, 192, 0, 7, 11, 1, 9, 25, 24, 0, 0, 1, 4, 27, 0, 119, 0, 15, 0, 106, 24, 12, 8, 38, 24, 24, 1, 120, 24, 4, 0, 1, 15, 0, 0, 1, 4, 26, 0, 119, 0, 9, 0, 1, 25, 24, 0, 2, 23, 0, 0, 199, 104, 11, 0, 25, 26, 5, 8, 135, 24, 5, 0, 9, 25, 23, 26, 1, 15, 0, 0, 1, 4, 26, 0, 32, 24, 4, 26, 121, 24, 3, 0, 0, 16, 15, 0, 119, 0, 8, 0, 32, 24, 4, 27, 121, 24, 6, 0, 34, 24, 14, 0, 121, 24, 3, 0, 0, 10, 14, 0, 119, 0, 33, 1, 0, 16, 14, 0, 1, 24, 252, 4, 97, 9, 24, 16, 1, 24, 68, 5, 3, 7, 9, 24, 82, 24, 7, 0, 120, 24, 12, 0, 82, 12, 2, 0, 121, 12, 10, 0, 1, 24, 128, 0, 94, 11, 12, 24, 121, 11, 7, 0, 135, 12, 143, 0, 11, 0, 0, 0, 85, 7, 12, 0, 120, 12, 3, 0, 1, 10, 244, 255, 119, 0, 15, 1, 1, 24, 80, 5, 3, 12, 9, 24, 82, 24, 12, 0, 120, 24, 12, 0, 82, 7, 2, 0, 121, 7, 10, 0, 1, 24, 132, 0, 94, 11, 7, 24, 121, 11, 7, 0, 135, 7, 143, 0, 11, 0, 0, 0, 85, 12, 7, 0, 120, 7, 3, 0, 1, 10, 244, 255, 119, 0, 0, 1, 1, 24, 8, 5, 3, 7, 9, 24, 82, 12, 7, 0, 25, 11, 9, 4, 121, 12, 18, 0, 82, 26, 11, 0, 82, 26, 26, 0, 1, 23, 44, 0, 135, 24, 193, 0, 26, 12, 23, 0, 34, 24, 24, 1, 121, 24, 11, 0, 82, 23, 7, 0, 109, 5, 16, 23, 1, 24, 16, 0, 2, 26, 0, 0, 13, 104, 11, 0, 25, 25, 5, 16, 135, 23, 5, 0, 9, 24, 26, 25, 1, 10, 234, 255, 119, 0, 234, 0, 1, 23, 232, 4, 3, 7, 9, 23, 82, 25, 2, 0, 82, 26, 7, 0, 106, 24, 7, 4, 135, 23, 159, 0, 25, 26, 24, 0, 135, 23, 2, 0, 82, 7, 11, 0, 106, 23, 7, 8, 38, 23, 23, 2, 120, 23, 3, 0, 0, 17, 7, 0, 119, 0, 7, 0, 135, 23, 194, 0, 1, 0, 0, 0, 120, 23, 3, 0, 1, 10, 234, 255, 119, 0, 215, 0, 82, 17, 11, 0, 1, 23, 40, 4, 3, 7, 9, 23, 1, 23, 0, 0, 85, 7, 23, 0, 2, 24, 0, 0, 0, 0, 0, 128, 109, 7, 4, 24, 1, 24, 48, 4, 3, 7, 9, 24, 1, 24, 0, 0, 85, 7, 24, 0, 2, 23, 0, 0, 0, 0, 0, 128, 109, 7, 4, 23, 106, 7, 17, 36, 1, 23, 0, 0, 47, 23, 23, 7, 180, 35, 1, 0, 135, 12, 93, 0, 7, 0, 0, 0, 25, 7, 9, 12, 85, 7, 12, 0, 120, 12, 3, 0, 1, 10, 244, 255, 119, 0, 189, 0, 82, 23, 11, 0, 106, 13, 23, 20, 121, 13, 13, 0, 85, 12, 13, 0, 82, 24, 7, 0, 135, 23, 195, 0, 24, 0, 0, 0, 82, 23, 7, 0, 25, 24, 5, 40, 135, 13, 189, 0, 23, 24, 0, 0, 34, 24, 13, 0, 121, 24, 3, 0, 0, 10, 13, 0, 119, 0, 174, 0, 82, 13, 2, 0, 121, 13, 9, 0, 1, 23, 12, 5, 94, 23, 9, 23, 25, 23, 23, 96, 2, 26, 0, 0, 103, 134, 11, 0, 25, 25, 5, 36, 135, 24, 196, 0, 13, 23, 26, 25, 1, 24, 72, 4, 3, 13, 9, 24, 82, 24, 13, 0, 2, 25, 0, 0, 0, 0, 2, 0, 19, 24, 24, 25, 120, 24, 12, 0, 82, 24, 11, 0, 106, 7, 24, 44, 121, 7, 9, 0, 1, 24, 255, 1, 19, 24, 7, 24, 135, 12, 197, 0, 24, 9, 0, 0, 34, 24, 12, 0, 121, 24, 3, 0, 0, 10, 12, 0, 119, 0, 146, 0, 1, 24, 140, 4, 3, 12, 9, 24, 1, 24, 12, 5, 3, 7, 9, 24, 82, 24, 7, 0, 25, 18, 24, 96, 82, 19, 18, 0, 82, 24, 12, 0, 120, 24, 5, 0, 85, 12, 19, 0, 1, 24, 0, 0, 85, 18, 24, 0, 119, 0, 24, 0, 121, 19, 23, 0, 1, 24, 156, 4, 3, 19, 9, 24, 82, 25, 19, 0, 43, 25, 25, 14, 38, 25, 25, 8, 40, 25, 25, 24, 2, 26, 0, 0, 24, 105, 11, 0, 25, 23, 5, 24, 135, 24, 5, 0, 9, 25, 26, 23, 82, 23, 7, 0, 25, 23, 23, 96, 135, 24, 79, 0, 23, 0, 0, 0, 82, 24, 19, 0, 38, 24, 24, 8, 121, 24, 5, 0, 2, 8, 0, 0, 183, 177, 187, 190, 137, 5, 0, 0, 139, 8, 0, 0, 106, 24, 5, 36, 121, 24, 42, 0, 82, 24, 11, 0, 82, 19, 24, 0, 135, 24, 19, 0, 19, 22, 0, 0, 121, 24, 16, 0, 135, 24, 19, 0, 19, 21, 0, 0, 120, 24, 2, 0, 119, 0, 12, 0, 2, 23, 0, 0, 75, 97, 12, 0, 135, 24, 19, 0, 19, 23, 0, 0, 120, 24, 2, 0, 119, 0, 6, 0, 1, 23, 48, 0, 25, 26, 5, 32, 135, 24, 5, 0, 9, 23, 20, 26, 119, 0, 22, 0, 25, 24, 5, 36, 135, 19, 198, 0, 9, 24, 0, 0, 34, 24, 19, 0, 121, 24, 3, 0, 0, 10, 19, 0, 119, 0, 81, 0, 25, 24, 5, 36, 135, 19, 199, 0, 9, 24, 0, 0, 34, 24, 19, 0, 121, 24, 3, 0, 0, 10, 19, 0, 119, 0, 74, 0, 25, 24, 5, 36, 135, 19, 200, 0, 9, 24, 0, 0, 34, 24, 19, 0, 121, 24, 3, 0, 0, 10, 19, 0, 119, 0, 67, 0, 25, 26, 5, 36, 135, 24, 201, 0, 26, 0, 0, 0, 135, 11, 202, 0, 9, 0, 0, 0, 34, 24, 11, 0, 121, 24, 3, 0, 0, 10, 11, 0, 119, 0, 58, 0, 82, 24, 13, 0, 2, 26, 0, 0, 0, 0, 2, 0, 19, 24, 24, 26, 120, 24, 23, 0, 82, 11, 2, 0, 120, 11, 2, 0, 119, 0, 20, 0, 82, 24, 7, 0, 25, 19, 24, 16, 82, 24, 19, 0, 32, 24, 24, 0, 106, 26, 19, 4, 32, 26, 26, 0, 19, 24, 24, 26, 120, 24, 2, 0, 119, 0, 11, 0, 1, 24, 0, 0, 1, 26, 0, 0, 1, 23, 1, 0, 135, 19, 33, 0, 11, 24, 26, 23, 135, 11, 2, 0, 82, 23, 7, 0, 25, 18, 23, 16, 85, 18, 19, 0, 109, 18, 4, 11, 82, 23, 7, 0, 2, 26, 0, 0, 160, 37, 38, 0, 109, 23, 40, 26, 135, 26, 187, 0, 9, 0, 0, 0, 106, 13, 9, 24, 121, 13, 14, 0, 106, 11, 9, 28, 1, 18, 0, 0, 41, 26, 18, 2, 94, 19, 11, 26, 1, 26, 184, 2, 94, 26, 19, 26, 1, 23, 176, 0, 94, 23, 19, 23, 106, 23, 23, 4, 109, 26, 24, 23, 25, 18, 18, 1, 55, 23, 18, 13, 24, 38, 1, 0, 121, 3, 5, 0, 135, 23, 79, 0, 3, 0, 0, 0, 25, 23, 5, 40, 116, 3, 23, 0, 85, 0, 9, 0, 1, 8, 0, 0, 137, 5, 0, 0, 139, 8, 0, 0, 25, 26, 5, 36, 135, 23, 201, 0, 26, 0, 0, 0, 25, 26, 5, 40, 135, 23, 79, 0, 26, 0, 0, 0, 82, 23, 2, 0, 121, 23, 8, 0, 1, 23, 72, 4, 94, 23, 9, 23, 1, 26, 128, 0, 19, 23, 23, 26, 120, 23, 3, 0, 135, 23, 203, 0, 2, 0, 0, 0, 135, 23, 204, 0, 9, 0, 0, 0, 1, 23, 0, 0, 85, 0, 23, 0, 0, 8, 10, 0, 137, 5, 0, 0, 139, 8, 0, 0, 140, 6, 54, 0, 0, 0, 0, 0, 2, 42, 0, 0, 72, 145, 0, 0, 2, 43, 0, 0, 64, 2, 0, 0, 2, 44, 0, 0, 48, 145, 0, 0, 2, 45, 0, 0, 64, 145, 0, 0, 2, 46, 0, 0, 64, 1, 0, 0, 2, 47, 0, 0, 68, 72, 1, 0, 94, 6, 0, 47, 106, 7, 0, 76, 106, 8, 0, 72, 106, 9, 0, 64, 76, 47, 9, 0, 145, 10, 47, 0, 62, 48, 0, 0, 167, 186, 168, 95, 231, 251, 239, 63, 145, 48, 48, 0, 65, 47, 10, 48, 145, 47, 47, 0, 75, 11, 47, 0, 106, 12, 0, 60, 62, 48, 0, 0, 196, 150, 253, 62, 12, 2, 240, 63, 145, 48, 48, 0, 65, 47, 10, 48, 145, 47, 47, 0, 75, 47, 47, 0, 17, 47, 12, 47, 17, 48, 11, 12, 19, 47, 47, 48, 121, 47, 25, 0, 5, 48, 7, 43, 47, 48, 48, 3, 116, 39, 1, 0, 5, 48, 7, 43, 0, 47, 48, 0, 119, 0, 2, 0, 0, 47, 3, 0, 0, 11, 47, 0, 1, 13, 0, 0, 41, 48, 13, 2, 94, 48, 1, 48, 41, 49, 6, 2, 3, 48, 48, 49, 41, 49, 13, 2, 94, 49, 2, 49, 41, 50, 11, 2, 135, 47, 52, 0, 48, 49, 50, 0, 25, 13, 13, 1, 54, 47, 13, 8, 128, 39, 1, 0, 85, 5, 11, 0, 85, 4, 11, 0, 139, 0, 0, 0, 1, 11, 0, 0, 0, 13, 12, 0, 0, 12, 9, 0, 41, 47, 11, 2, 94, 47, 1, 47, 41, 50, 6, 2, 3, 9, 47, 50, 41, 50, 11, 2, 94, 14, 2, 50, 76, 50, 13, 0, 76, 47, 12, 0, 66, 15, 50, 47, 120, 13, 3, 0, 0, 16, 12, 0, 119, 0, 11, 0, 0, 17, 13, 0, 0, 18, 12, 0, 8, 19, 18, 17, 120, 19, 3, 0, 0, 16, 17, 0, 119, 0, 5, 0, 0, 20, 17, 0, 0, 17, 19, 0, 0, 18, 20, 0, 119, 0, 249, 255, 6, 18, 12, 16, 15, 47, 18, 46, 125, 17, 47, 18, 46, 0, 0, 0, 61, 49, 0, 0, 0, 0, 0, 63, 63, 49, 15, 49, 135, 50, 54, 0, 49, 0, 0, 0, 64, 50, 15, 50, 135, 47, 53, 0, 50, 0, 0, 0, 62, 50, 0, 0, 45, 67, 28, 235, 226, 54, 26, 63, 71, 18, 47, 50, 59, 50, 1, 0, 66, 10, 50, 15, 145, 10, 10, 0, 59, 50, 1, 0, 145, 50, 50, 0, 73, 20, 10, 50, 121, 20, 5, 0, 59, 47, 1, 0, 145, 47, 47, 0, 58, 50, 47, 0, 119, 0, 2, 0, 58, 50, 10, 0, 58, 21, 50, 0, 1, 50, 32, 0, 1, 47, 31, 0, 125, 20, 18, 50, 47, 0, 0, 0, 106, 47, 0, 12, 120, 47, 206, 0, 25, 47, 20, 1, 1, 50, 4, 0, 135, 18, 205, 0, 47, 50, 0, 0, 97, 0, 45, 18, 25, 50, 20, 1, 1, 47, 4, 0, 135, 18, 205, 0, 50, 47, 0, 0, 2, 47, 0, 0, 68, 145, 0, 0, 97, 0, 47, 18, 34, 47, 17, 0, 121, 47, 14, 0, 1, 50, 0, 0, 97, 0, 44, 50, 3, 50, 0, 44, 1, 47, 0, 0, 109, 50, 4, 47, 3, 47, 0, 44, 1, 50, 0, 0, 109, 47, 8, 50, 3, 50, 0, 44, 1, 47, 0, 0, 109, 50, 12, 47, 1, 22, 0, 0, 119, 0, 175, 0, 1, 18, 0, 0, 25, 47, 20, 1, 1, 50, 4, 0, 135, 19, 205, 0, 47, 50, 0, 0, 3, 50, 0, 42, 41, 47, 18, 2, 97, 50, 47, 19, 41, 47, 17, 1, 47, 47, 18, 47, 76, 41, 1, 0, 25, 18, 18, 1, 119, 0, 245, 255, 119, 0, 1, 0, 1, 50, 0, 0, 97, 0, 44, 50, 3, 50, 0, 44, 1, 47, 0, 0, 109, 50, 4, 47, 3, 47, 0, 44, 1, 50, 0, 0, 109, 47, 8, 50, 3, 50, 0, 44, 1, 47, 0, 0, 109, 50, 12, 47, 62, 47, 0, 0, 24, 45, 68, 84, 251, 33, 9, 64, 65, 10, 21, 47, 145, 10, 10, 0, 76, 47, 20, 0, 145, 23, 47, 0, 59, 47, 1, 0, 145, 47, 47, 0, 66, 24, 47, 23, 145, 24, 24, 0, 65, 25, 23, 10, 145, 25, 25, 0, 1, 18, 0, 0, 61, 47, 0, 0, 0, 0, 0, 63, 76, 50, 17, 0, 66, 47, 47, 50, 4, 50, 18, 17, 76, 50, 50, 0, 65, 23, 47, 50, 145, 23, 23, 0, 3, 50, 0, 42, 41, 47, 18, 2, 94, 19, 50, 47, 59, 26, 0, 0, 145, 26, 26, 0, 1, 27, 0, 0, 76, 49, 27, 0, 145, 47, 49, 0, 64, 50, 47, 23, 145, 50, 50, 0, 65, 28, 50, 24, 145, 28, 28, 0, 59, 50, 0, 0, 145, 50, 50, 0, 71, 29, 28, 50, 121, 29, 5, 0, 59, 47, 0, 0, 145, 47, 47, 0, 58, 50, 47, 0, 119, 0, 2, 0, 58, 50, 28, 0, 58, 30, 50, 0, 59, 50, 1, 0, 145, 50, 50, 0, 73, 29, 30, 50, 121, 29, 5, 0, 59, 47, 1, 0, 145, 47, 47, 0, 58, 50, 47, 0, 119, 0, 2, 0, 58, 50, 30, 0, 58, 28, 50, 0, 61, 50, 0, 0, 0, 0, 0, 191, 145, 50, 50, 0, 63, 30, 28, 50, 145, 30, 30, 0, 135, 50, 53, 0, 30, 0, 0, 0, 62, 47, 0, 0, 149, 214, 38, 232, 11, 46, 17, 62, 71, 50, 50, 47, 121, 50, 6, 0, 62, 50, 0, 0, 131, 200, 201, 109, 48, 95, 212, 63, 65, 31, 10, 50, 119, 0, 46, 0, 59, 49, 2, 0, 145, 49, 49, 0, 65, 47, 28, 49, 145, 47, 47, 0, 62, 49, 0, 0, 24, 45, 68, 84, 251, 33, 9, 64, 65, 47, 47, 49, 135, 50, 206, 0, 47, 0, 0, 0, 61, 47, 0, 0, 0, 0, 0, 191, 65, 50, 50, 47, 62, 47, 0, 0, 225, 122, 20, 174, 71, 225, 218, 63, 63, 32, 50, 47, 59, 49, 4, 0, 145, 49, 49, 0, 65, 50, 28, 49, 145, 50, 50, 0, 62, 49, 0, 0, 24, 45, 68, 84, 251, 33, 9, 64, 65, 50, 50, 49, 135, 47, 206, 0, 50, 0, 0, 0, 62, 50, 0, 0, 123, 20, 174, 71, 225, 122, 180, 63, 65, 47, 47, 50, 63, 33, 32, 47, 145, 33, 33, 0, 65, 50, 25, 30, 145, 50, 50, 0, 135, 47, 207, 0, 50, 0, 0, 0, 65, 47, 47, 33, 76, 50, 20, 0, 62, 49, 0, 0, 24, 45, 68, 84, 251, 33, 9, 64, 65, 50, 50, 49, 65, 50, 50, 30, 66, 31, 47, 50, 145, 30, 31, 0, 41, 50, 27, 2, 101, 19, 50, 30, 63, 26, 26, 30, 145, 26, 26, 0, 25, 27, 27, 1, 25, 50, 20, 1, 53, 50, 27, 50, 236, 41, 1, 0, 59, 50, 1, 0, 145, 50, 50, 0, 66, 23, 50, 26, 145, 23, 23, 0, 1, 27, 0, 0, 41, 50, 27, 2, 3, 29, 19, 50, 88, 50, 29, 0, 145, 50, 50, 0, 65, 30, 50, 23, 145, 30, 30, 0, 89, 29, 30, 0, 25, 27, 27, 1, 25, 50, 20, 1, 53, 50, 27, 50, 132, 43, 1, 0, 25, 27, 18, 1, 41, 50, 17, 1, 47, 50, 18, 50, 200, 43, 1, 0, 0, 18, 27, 0, 119, 0, 124, 255, 0, 22, 27, 0, 119, 0, 1, 0, 1, 47, 1, 0, 109, 0, 12, 47, 0, 34, 22, 0, 119, 0, 2, 0, 1, 34, 0, 0, 3, 47, 0, 45, 41, 50, 11, 2, 94, 18, 47, 50, 3, 47, 0, 44, 41, 50, 11, 3, 3, 27, 47, 50, 86, 33, 27, 0, 1, 50, 0, 0, 47, 50, 50, 7, 96, 45, 1, 0, 76, 50, 17, 0, 145, 25, 50, 0, 59, 50, 2, 0, 145, 50, 50, 0, 65, 10, 25, 50, 145, 10, 10, 0, 1, 19, 0, 0, 76, 50, 19, 0, 65, 50, 15, 50, 64, 32, 50, 33, 135, 50, 54, 0, 32, 0, 0, 0, 75, 29, 50, 0, 28, 50, 20, 254, 3, 50, 50, 20, 3, 35, 50, 29, 49, 50, 3, 35, 96, 44, 1, 0, 0, 36, 19, 0, 0, 37, 35, 0, 119, 0, 69, 0, 3, 50, 0, 42, 38, 52, 20, 1, 76, 52, 52, 0, 61, 53, 0, 0, 0, 0, 0, 191, 65, 52, 52, 53, 63, 52, 32, 52, 76, 53, 29, 0, 64, 51, 52, 53, 145, 51, 51, 0, 65, 48, 10, 51, 145, 48, 48, 0, 63, 49, 48, 25, 145, 49, 49, 0, 61, 48, 0, 0, 0, 0, 0, 63, 63, 49, 49, 48, 135, 47, 54, 0, 49, 0, 0, 0, 75, 47, 47, 0, 41, 47, 47, 2, 3, 38, 50, 47, 82, 39, 38, 0, 59, 24, 0, 0, 145, 24, 24, 0, 1, 38, 0, 0, 28, 47, 20, 254, 3, 47, 47, 29, 3, 40, 47, 38, 34, 50, 40, 0, 121, 50, 7, 0, 25, 50, 20, 1, 3, 50, 40, 50, 41, 50, 50, 2, 3, 50, 18, 50, 0, 47, 50, 0, 119, 0, 4, 0, 41, 50, 40, 2, 3, 50, 14, 50, 0, 47, 50, 0, 88, 21, 47, 0, 145, 21, 21, 0, 41, 49, 38, 2, 100, 50, 39, 49, 145, 50, 50, 0, 65, 47, 50, 21, 145, 47, 47, 0, 63, 24, 47, 24, 145, 24, 24, 0, 25, 38, 38, 1, 25, 47, 20, 1, 53, 47, 38, 47, 200, 44, 1, 0, 41, 47, 19, 2, 101, 9, 47, 24, 25, 38, 19, 1, 5, 47, 7, 43, 47, 47, 38, 47, 84, 45, 1, 0, 0, 19, 38, 0, 119, 0, 182, 255, 0, 36, 38, 0, 0, 37, 35, 0, 119, 0, 5, 0, 1, 36, 0, 0, 28, 47, 20, 254, 3, 47, 47, 20, 3, 37, 34, 47, 15, 47, 3, 37, 125, 9, 47, 3, 37, 0, 0, 0, 85, 4, 9, 0, 76, 47, 9, 0, 63, 47, 33, 47, 76, 50, 36, 0, 65, 50, 15, 50, 64, 47, 47, 50, 87, 27, 47, 0, 47, 47, 20, 9, 212, 45, 1, 0, 1, 17, 0, 0, 41, 47, 17, 2, 11, 50, 20, 0, 3, 50, 9, 50, 3, 50, 50, 17, 41, 50, 50, 2, 94, 50, 14, 50, 97, 18, 47, 50, 25, 17, 17, 1, 25, 50, 20, 1, 53, 50, 17, 50, 164, 45, 1, 0, 119, 0, 35, 0, 1, 50, 0, 0, 25, 47, 20, 1, 4, 47, 47, 9, 47, 50, 50, 47, 32, 46, 1, 0, 1, 17, 0, 0, 41, 50, 17, 2, 3, 47, 17, 9, 41, 47, 47, 2, 94, 47, 18, 47, 97, 18, 50, 47, 25, 17, 17, 1, 25, 47, 20, 1, 4, 47, 47, 9, 54, 47, 17, 47, 236, 45, 1, 0, 25, 47, 20, 1, 4, 41, 47, 9, 119, 0, 2, 0, 1, 41, 0, 0, 49, 47, 41, 20, 92, 46, 1, 0, 1, 9, 0, 0, 0, 17, 41, 0, 41, 47, 17, 2, 41, 50, 9, 2, 94, 50, 14, 50, 97, 18, 47, 50, 47, 50, 17, 20, 88, 46, 1, 0, 25, 9, 9, 1, 25, 17, 17, 1, 119, 0, 248, 255, 119, 0, 1, 0, 25, 17, 11, 1, 56, 50, 8, 17, 120, 46, 1, 0, 0, 11, 17, 0, 106, 13, 0, 60, 106, 12, 0, 64, 119, 0, 85, 254, 85, 5, 36, 0, 139, 0, 0, 0, 140, 2, 22, 0, 0, 0, 0, 0, 136, 17, 0, 0, 0, 2, 17, 0, 136, 17, 0, 0, 1, 18, 192, 0, 3, 17, 17, 18, 137, 17, 0, 0, 1, 18, 55, 0, 135, 17, 208, 0, 18, 0, 0, 0, 2, 18, 0, 0, 36, 230, 9, 0, 82, 18, 18, 0, 1, 19, 0, 0, 1, 20, 2, 0, 1, 21, 0, 0, 135, 17, 209, 0, 18, 19, 20, 21, 1, 21, 1, 0, 135, 17, 210, 0, 21, 0, 0, 0, 1, 21, 192, 77, 135, 17, 211, 0, 0, 1, 21, 0, 1, 17, 1, 0, 47, 17, 17, 0, 60, 47, 1, 0, 106, 21, 1, 4, 2, 20, 0, 0, 58, 93, 10, 0, 135, 17, 19, 0, 21, 20, 0, 0, 120, 17, 11, 0, 2, 17, 0, 0, 72, 188, 65, 0, 1, 20, 1, 0, 85, 17, 20, 0, 1, 17, 5, 0, 135, 20, 212, 0, 17, 0, 0, 0, 26, 3, 0, 1, 25, 4, 1, 4, 119, 0, 6, 0, 0, 3, 0, 0, 0, 4, 1, 0, 119, 0, 3, 0, 0, 3, 0, 0, 0, 4, 1, 0, 1, 17, 192, 77, 135, 20, 213, 0, 3, 4, 17, 0, 134, 20, 0, 0, 244, 61, 1, 0, 3, 4, 0, 0, 34, 20, 20, 0, 121, 20, 4, 0, 1, 17, 1, 0, 135, 20, 13, 0, 17, 0, 0, 0, 2, 20, 0, 0, 244, 187, 65, 0, 82, 4, 20, 0, 34, 20, 4, 1, 2, 17, 0, 0, 228, 187, 65, 0, 82, 17, 17, 0, 32, 17, 17, 0, 19, 20, 20, 17, 121, 20, 14, 0, 135, 20, 214, 0, 2, 20, 0, 0, 58, 8, 12, 0, 85, 2, 20, 0, 1, 17, 0, 0, 1, 21, 24, 0, 2, 19, 0, 0, 61, 93, 10, 0, 135, 20, 5, 0, 17, 21, 19, 2, 1, 19, 1, 0, 135, 20, 13, 0, 19, 0, 0, 0, 34, 20, 4, 1, 121, 20, 11, 0, 1, 19, 0, 0, 1, 21, 8, 0, 2, 17, 0, 0, 116, 93, 10, 0, 25, 18, 2, 8, 135, 20, 5, 0, 19, 21, 17, 18, 1, 18, 1, 0, 135, 20, 13, 0, 18, 0, 0, 0, 2, 20, 0, 0, 240, 187, 65, 0, 82, 3, 20, 0, 1, 1, 0, 0, 41, 18, 1, 2, 94, 18, 3, 18, 82, 18, 18, 0, 106, 18, 18, 8, 82, 18, 18, 0, 2, 17, 0, 0, 58, 102, 11, 0, 135, 20, 19, 0, 18, 17, 0, 0, 121, 20, 5, 0, 2, 20, 0, 0, 252, 117, 9, 0, 1, 17, 0, 0, 85, 20, 17, 0, 25, 1, 1, 1, 53, 17, 1, 4, 12, 48, 1, 0, 135, 4, 1, 0, 135, 1, 2, 0, 1, 20, 0, 0, 25, 18, 2, 56, 135, 17, 215, 0, 20, 18, 0, 0, 106, 3, 2, 56, 34, 17, 3, 0, 41, 17, 17, 31, 42, 17, 17, 31, 2, 18, 0, 0, 64, 66, 15, 0, 1, 20, 0, 0, 135, 0, 90, 0, 3, 17, 18, 20, 135, 3, 2, 0, 25, 20, 2, 56, 106, 5, 20, 4, 34, 20, 5, 0, 41, 20, 20, 31, 42, 20, 20, 31, 135, 6, 44, 0, 0, 3, 5, 20, 135, 5, 2, 0, 25, 20, 2, 56, 106, 3, 20, 8, 34, 20, 3, 0, 41, 20, 20, 31, 42, 20, 20, 31, 2, 18, 0, 0, 64, 66, 15, 0, 1, 17, 0, 0, 135, 0, 90, 0, 3, 20, 18, 17, 135, 3, 2, 0, 25, 17, 2, 56, 106, 7, 17, 12, 34, 17, 7, 0, 41, 17, 17, 31, 42, 17, 17, 31, 135, 8, 44, 0, 0, 3, 7, 17, 135, 7, 2, 0, 2, 17, 0, 0, 16, 187, 65, 0, 85, 17, 4, 0, 2, 17, 0, 0, 20, 187, 65, 0, 85, 17, 1, 0, 2, 17, 0, 0, 24, 187, 65, 0, 85, 17, 6, 0, 2, 17, 0, 0, 28, 187, 65, 0, 85, 17, 5, 0, 2, 17, 0, 0, 32, 187, 65, 0, 85, 17, 8, 0, 2, 17, 0, 0, 36, 187, 65, 0, 85, 17, 7, 0, 134, 17, 0, 0, 0, 0, 0, 0, 34, 17, 17, 0, 121, 17, 4, 0, 1, 18, 1, 0, 135, 17, 13, 0, 18, 0, 0, 0, 2, 17, 0, 0, 68, 187, 65, 0, 82, 17, 17, 0, 121, 17, 110, 0, 135, 3, 1, 0, 135, 0, 2, 0, 1, 18, 0, 0, 25, 20, 2, 56, 135, 17, 215, 0, 18, 20, 0, 0, 106, 9, 2, 56, 34, 17, 9, 0, 41, 17, 17, 31, 42, 17, 17, 31, 2, 20, 0, 0, 64, 66, 15, 0, 1, 18, 0, 0, 135, 10, 90, 0, 9, 17, 20, 18, 135, 9, 2, 0, 25, 18, 2, 56, 106, 11, 18, 4, 34, 18, 11, 0, 41, 18, 18, 31, 42, 18, 18, 31, 135, 12, 44, 0, 10, 9, 11, 18, 135, 11, 2, 0, 25, 18, 2, 56, 106, 9, 18, 8, 34, 18, 9, 0, 41, 18, 18, 31, 42, 18, 18, 31, 2, 20, 0, 0, 64, 66, 15, 0, 1, 17, 0, 0, 135, 10, 90, 0, 9, 18, 20, 17, 135, 9, 2, 0, 25, 17, 2, 56, 106, 13, 17, 12, 34, 17, 13, 0, 41, 17, 17, 31, 42, 17, 17, 31, 135, 14, 44, 0, 10, 9, 13, 17, 135, 13, 2, 0, 2, 17, 0, 0, 16, 187, 65, 0, 85, 17, 3, 0, 2, 17, 0, 0, 20, 187, 65, 0, 85, 17, 0, 0, 2, 17, 0, 0, 24, 187, 65, 0, 85, 17, 12, 0, 2, 17, 0, 0, 28, 187, 65, 0, 85, 17, 11, 0, 2, 17, 0, 0, 32, 187, 65, 0, 85, 17, 14, 0, 2, 17, 0, 0, 36, 187, 65, 0, 85, 17, 13, 0, 135, 9, 20, 0, 12, 11, 6, 5, 135, 5, 2, 0, 135, 6, 20, 0, 14, 13, 8, 7, 135, 7, 2, 0, 135, 8, 20, 0, 3, 0, 4, 1, 77, 17, 8, 0, 61, 20, 0, 0, 0, 0, 128, 79, 135, 18, 2, 0, 76, 18, 18, 0, 65, 20, 20, 18, 63, 17, 17, 20, 60, 20, 0, 0, 64, 66, 15, 0, 66, 15, 17, 20, 77, 17, 9, 0, 61, 18, 0, 0, 0, 0, 128, 79, 76, 21, 5, 0, 65, 18, 18, 21, 63, 17, 17, 18, 60, 18, 0, 0, 64, 66, 15, 0, 66, 17, 17, 18, 111, 2, 16, 17, 25, 17, 2, 16, 77, 20, 6, 0, 61, 18, 0, 0, 0, 0, 128, 79, 76, 21, 7, 0, 65, 18, 18, 21, 63, 20, 20, 18, 60, 18, 0, 0, 64, 66, 15, 0, 66, 20, 20, 18, 111, 17, 8, 20, 25, 20, 2, 16, 111, 20, 16, 15, 1, 17, 0, 0, 1, 18, 32, 0, 2, 21, 0, 0, 160, 93, 10, 0, 25, 19, 2, 16, 135, 20, 5, 0, 17, 18, 21, 19, 2, 20, 0, 0, 244, 177, 22, 0, 82, 7, 20, 0, 2, 20, 0, 0, 248, 177, 22, 0, 82, 6, 20, 0, 2, 20, 0, 0, 252, 177, 22, 0, 82, 5, 20, 0, 2, 19, 0, 0, 240, 177, 22, 0, 82, 19, 19, 0, 109, 2, 40, 19, 25, 19, 2, 40, 109, 19, 4, 7, 25, 19, 2, 40, 25, 7, 19, 8, 85, 7, 6, 0, 109, 7, 4, 5, 1, 20, 0, 0, 1, 21, 48, 0, 2, 18, 0, 0, 207, 93, 10, 0, 25, 17, 2, 40, 135, 19, 5, 0, 20, 21, 18, 17, 2, 19, 0, 0, 248, 177, 22, 0, 82, 2, 19, 0, 2, 19, 0, 0, 252, 177, 22, 0, 82, 5, 19, 0, 2, 19, 0, 0, 240, 177, 22, 0, 82, 19, 19, 0, 2, 17, 0, 0, 244, 177, 22, 0, 82, 17, 17, 0, 135, 7, 44, 0, 2, 5, 19, 17, 77, 17, 7, 0, 61, 19, 0, 0, 0, 0, 128, 79, 135, 18, 2, 0, 76, 18, 18, 0, 65, 19, 19, 18, 63, 16, 17, 19, 145, 16, 16, 0, 2, 18, 0, 0, 152, 117, 9, 0, 88, 17, 18, 0, 145, 17, 17, 0, 65, 19, 17, 16, 145, 19, 19, 0, 77, 18, 2, 0, 61, 21, 0, 0, 0, 0, 128, 79, 76, 20, 5, 0, 65, 21, 21, 20, 63, 17, 18, 21, 145, 17, 17, 0, 71, 19, 19, 17, 121, 19, 5, 0, 1, 17, 69, 0, 135, 19, 13, 0, 17, 0, 0, 0, 119, 0, 15, 0, 2, 21, 0, 0, 248, 187, 65, 0, 82, 21, 21, 0, 32, 21, 21, 0, 121, 21, 6, 0, 2, 21, 0, 0, 80, 188, 65, 0, 82, 21, 21, 0, 0, 17, 21, 0, 119, 0, 3, 0, 1, 21, 255, 0, 0, 17, 21, 0, 135, 19, 13, 0, 17, 0, 0, 0, 1, 19, 0, 0, 139, 19, 0, 0, 140, 3, 29, 0, 0, 0, 0, 0, 2, 23, 0, 0, 187, 176, 185, 223, 2, 24, 0, 0, 255, 0, 0, 0, 1, 3, 0, 0, 136, 25, 0, 0, 0, 4, 25, 0, 136, 25, 0, 0, 25, 25, 25, 16, 137, 25, 0, 0, 1, 25, 0, 0, 47, 25, 25, 2, 56, 55, 1, 0, 106, 5, 0, 12, 0, 6, 2, 0, 0, 7, 1, 0, 0, 1, 5, 0, 0, 8, 5, 0, 106, 25, 0, 16, 4, 5, 25, 1, 15, 25, 6, 5, 125, 9, 25, 6, 5, 0, 0, 0, 120, 9, 3, 0, 1, 3, 5, 0, 119, 0, 14, 0, 106, 25, 0, 52, 120, 25, 11, 0, 135, 25, 52, 0, 7, 8, 9, 0, 106, 25, 0, 12, 3, 5, 25, 9, 109, 0, 12, 5, 4, 10, 6, 9, 3, 11, 7, 9, 0, 12, 5, 0, 0, 13, 5, 0, 119, 0, 2, 0, 1, 3, 5, 0, 32, 25, 3, 5, 121, 25, 98, 0, 1, 3, 0, 0, 106, 25, 0, 96, 120, 25, 6, 0, 106, 25, 0, 8, 47, 25, 25, 6, 56, 53, 1, 0, 1, 3, 7, 0, 119, 0, 2, 0, 1, 3, 7, 0, 32, 25, 3, 7, 121, 25, 75, 0, 1, 3, 0, 0, 106, 25, 0, 68, 120, 25, 72, 0, 106, 5, 0, 24, 120, 5, 4, 0, 1, 14, 234, 255, 1, 3, 14, 0, 119, 0, 89, 0, 19, 25, 5, 24, 106, 26, 0, 20, 135, 9, 216, 0, 25, 26, 7, 6, 34, 25, 9, 0, 121, 25, 10, 0, 2, 25, 0, 0, 187, 176, 185, 223, 1, 26, 1, 0, 138, 9, 25, 26, 156, 53, 1, 0, 1, 3, 13, 0, 119, 0, 15, 0, 1, 3, 12, 0, 119, 0, 74, 0, 1, 25, 0, 0, 1, 26, 1, 0, 138, 9, 25, 26, 188, 53, 1, 0, 1, 3, 13, 0, 119, 0, 7, 0, 119, 0, 1, 0, 106, 25, 0, 56, 120, 25, 3, 0, 1, 3, 11, 0, 119, 0, 63, 0, 1, 15, 0, 0, 32, 25, 3, 13, 121, 25, 8, 0, 1, 3, 0, 0, 34, 25, 9, 0, 121, 25, 4, 0, 0, 14, 9, 0, 1, 3, 14, 0, 119, 0, 54, 0, 0, 15, 9, 0, 34, 25, 15, 0, 41, 25, 25, 31, 42, 25, 25, 31, 0, 5, 25, 0, 25, 25, 0, 40, 25, 16, 25, 4, 106, 25, 0, 40, 82, 26, 16, 0, 135, 17, 44, 0, 25, 26, 15, 5, 135, 18, 2, 0, 109, 0, 40, 17, 85, 16, 18, 0, 25, 26, 0, 104, 25, 18, 26, 4, 106, 26, 0, 104, 82, 25, 18, 0, 135, 16, 44, 0, 26, 25, 15, 5, 135, 5, 2, 0, 109, 0, 104, 16, 85, 18, 5, 0, 106, 5, 0, 4, 109, 0, 12, 5, 109, 0, 16, 5, 4, 10, 6, 15, 3, 11, 7, 15, 0, 12, 5, 0, 0, 13, 5, 0, 119, 0, 13, 0, 135, 25, 217, 0, 0, 0, 0, 0, 106, 5, 0, 12, 106, 25, 0, 16, 45, 25, 25, 5, 144, 54, 1, 0, 0, 19, 6, 0, 119, 0, 15, 0, 0, 10, 6, 0, 0, 11, 7, 0, 0, 12, 5, 0, 0, 13, 5, 0, 1, 25, 0, 0, 47, 25, 25, 10, 192, 54, 1, 0, 0, 6, 10, 0, 0, 7, 11, 0, 0, 1, 13, 0, 0, 8, 12, 0, 119, 0, 129, 255, 0, 19, 10, 0, 119, 0, 1, 0, 32, 25, 3, 11, 121, 25, 9, 0, 1, 26, 0, 0, 1, 27, 24, 0, 2, 28, 0, 0, 13, 191, 10, 0, 135, 25, 5, 0, 26, 27, 28, 4, 1, 3, 12, 0, 119, 0, 7, 0, 32, 25, 3, 14, 121, 25, 5, 0, 1, 28, 1, 0, 109, 0, 48, 28, 109, 0, 72, 14, 0, 19, 6, 0, 32, 28, 3, 12, 121, 28, 4, 0, 1, 25, 1, 0, 109, 0, 48, 25, 0, 19, 6, 0, 45, 25, 19, 2, 48, 55, 1, 0, 0, 20, 19, 0, 1, 3, 20, 0, 119, 0, 5, 0, 0, 21, 19, 0, 119, 0, 3, 0, 0, 20, 2, 0, 1, 3, 20, 0, 32, 25, 3, 20, 121, 25, 22, 0, 106, 3, 0, 72, 121, 3, 4, 0, 0, 22, 3, 0, 137, 4, 0, 0, 139, 22, 0, 0, 106, 25, 0, 48, 120, 25, 3, 0, 0, 21, 20, 0, 119, 0, 13, 0, 1, 28, 0, 0, 109, 0, 48, 28, 135, 28, 217, 0, 0, 0, 0, 0, 106, 28, 0, 48, 120, 28, 3, 0, 0, 21, 20, 0, 119, 0, 5, 0, 2, 22, 0, 0, 187, 176, 185, 223, 137, 4, 0, 0, 139, 22, 0, 0, 4, 22, 2, 21, 137, 4, 0, 0, 139, 22, 0, 0, 140, 3, 24, 0, 0, 0, 0, 0, 2, 16, 0, 0, 8, 64, 0, 0, 2, 17, 0, 0, 152, 0, 0, 0, 2, 18, 0, 0, 156, 0, 0, 0, 1, 3, 0, 0, 136, 19, 0, 0, 0, 4, 19, 0, 136, 19, 0, 0, 1, 20, 48, 2, 3, 19, 19, 20, 137, 19, 0, 0, 106, 19, 0, 8, 36, 19, 19, 0, 121, 19, 4, 0, 1, 5, 0, 0, 137, 4, 0, 0, 139, 5, 0, 0, 1, 6, 0, 0, 106, 7, 0, 4, 27, 19, 6, 36, 3, 8, 7, 19, 0, 7, 8, 0, 1, 20, 0, 0, 1, 21, 8, 2, 135, 19, 0, 0, 4, 20, 21, 0, 1, 19, 200, 0, 1, 21, 255, 255, 97, 4, 19, 21, 1, 21, 200, 0, 3, 21, 4, 21, 2, 19, 0, 0, 255, 255, 255, 127, 109, 21, 4, 19, 1, 19, 220, 0, 62, 21, 0, 0, 239, 33, 245, 95, 102, 102, 230, 63, 145, 21, 21, 0, 101, 4, 19, 21, 1, 19, 0, 0, 109, 4, 8, 19, 25, 19, 4, 8, 2, 21, 0, 0, 0, 0, 0, 128, 109, 19, 4, 21, 1, 19, 0, 0, 109, 4, 16, 19, 25, 19, 4, 16, 2, 21, 0, 0, 0, 0, 0, 128, 109, 19, 4, 21, 1, 21, 192, 0, 1, 19, 255, 255, 97, 4, 21, 19, 1, 19, 192, 0, 3, 19, 4, 19, 2, 21, 0, 0, 255, 255, 255, 127, 109, 19, 4, 21, 1, 21, 208, 0, 1, 19, 255, 255, 97, 4, 21, 19, 1, 19, 208, 0, 3, 19, 4, 19, 1, 21, 255, 255, 109, 19, 4, 21, 1, 21, 188, 0, 2, 19, 0, 0, 255, 255, 255, 127, 97, 4, 21, 19, 1, 21, 1, 0, 109, 4, 96, 21, 85, 4, 7, 0, 135, 9, 218, 0, 4, 7, 0, 0, 25, 10, 8, 4, 82, 11, 10, 0, 34, 21, 9, 0, 121, 21, 3, 0, 1, 3, 4, 0, 119, 0, 115, 0, 1, 21, 16, 2, 97, 4, 21, 1, 1, 21, 16, 2, 3, 21, 4, 21, 109, 21, 4, 11, 1, 19, 0, 0, 1, 20, 48, 0, 2, 22, 0, 0, 116, 34, 10, 0, 1, 23, 16, 2, 3, 23, 4, 23, 135, 21, 5, 0, 19, 20, 22, 23, 1, 21, 255, 0, 19, 21, 2, 21, 82, 23, 10, 0, 135, 12, 177, 0, 21, 4, 23, 0, 1, 8, 192, 77, 106, 21, 8, 8, 3, 7, 4, 21, 25, 13, 8, 4, 82, 14, 13, 0, 2, 21, 0, 0, 0, 128, 0, 0, 19, 21, 14, 21, 120, 21, 7, 0, 19, 21, 14, 16, 45, 21, 21, 16, 128, 57, 1, 0, 135, 21, 73, 0, 7, 0, 0, 0, 119, 0, 28, 0, 1, 21, 0, 0, 106, 23, 7, 4, 47, 21, 21, 23, 224, 57, 1, 0, 1, 14, 0, 0, 82, 23, 7, 0, 41, 22, 14, 4, 3, 23, 23, 22, 135, 21, 73, 0, 23, 0, 0, 0, 82, 21, 13, 0, 38, 21, 21, 8, 121, 21, 7, 0, 82, 23, 7, 0, 41, 22, 14, 4, 3, 23, 23, 22, 25, 23, 23, 8, 135, 21, 73, 0, 23, 0, 0, 0, 25, 14, 14, 1, 106, 21, 7, 4, 54, 21, 14, 21, 152, 57, 1, 0, 135, 21, 73, 0, 7, 0, 0, 0, 1, 23, 0, 0, 109, 7, 4, 23, 25, 8, 8, 20, 82, 23, 8, 0, 33, 23, 23, 0, 120, 23, 212, 255, 1, 23, 0, 0, 94, 21, 4, 18, 47, 23, 23, 21, 60, 58, 1, 0, 1, 8, 0, 0, 94, 21, 4, 17, 27, 22, 8, 24, 3, 21, 21, 22, 25, 21, 21, 20, 135, 23, 73, 0, 21, 0, 0, 0, 25, 8, 8, 1, 94, 23, 4, 18, 54, 23, 8, 23, 20, 58, 1, 0, 3, 21, 4, 17, 135, 23, 73, 0, 21, 0, 0, 0, 1, 21, 160, 0, 3, 21, 4, 21, 135, 23, 73, 0, 21, 0, 0, 0, 1, 21, 248, 0, 3, 21, 4, 21, 135, 23, 73, 0, 21, 0, 0, 0, 1, 21, 180, 0, 3, 21, 4, 21, 135, 23, 73, 0, 21, 0, 0, 0, 34, 23, 12, 0, 121, 23, 3, 0, 1, 3, 20, 0, 119, 0, 17, 0, 1, 21, 0, 0, 1, 22, 48, 0, 2, 20, 0, 0, 168, 34, 10, 0, 1, 19, 32, 2, 3, 19, 4, 19, 135, 23, 5, 0, 21, 22, 20, 19, 25, 6, 6, 1, 106, 23, 0, 8, 49, 23, 23, 6, 196, 58, 1, 0, 1, 5, 0, 0, 1, 3, 23, 0, 119, 0, 2, 0, 119, 0, 79, 255, 32, 23, 3, 4, 121, 23, 16, 0, 1, 23, 8, 2, 97, 4, 23, 1, 1, 23, 8, 2, 3, 23, 4, 23, 109, 23, 4, 11, 1, 19, 0, 0, 1, 20, 16, 0, 2, 22, 0, 0, 77, 34, 10, 0, 1, 21, 8, 2, 3, 21, 4, 21, 135, 23, 5, 0, 19, 20, 22, 21, 0, 15, 9, 0, 119, 0, 23, 0, 32, 23, 3, 20, 121, 23, 17, 0, 82, 9, 10, 0, 1, 23, 24, 2, 97, 4, 23, 1, 1, 23, 24, 2, 3, 23, 4, 23, 109, 23, 4, 9, 1, 21, 0, 0, 1, 22, 16, 0, 2, 20, 0, 0, 141, 34, 10, 0, 1, 19, 24, 2, 3, 19, 4, 19, 135, 23, 5, 0, 21, 22, 20, 19, 0, 15, 12, 0, 119, 0, 5, 0, 32, 23, 3, 23, 121, 23, 3, 0, 137, 4, 0, 0, 139, 5, 0, 0, 0, 5, 15, 0, 137, 4, 0, 0, 139, 5, 0, 0, 140, 3, 27, 0, 0, 0, 0, 0, 2, 21, 0, 0, 187, 176, 185, 223, 2, 22, 0, 0, 255, 0, 0, 0, 2, 23, 0, 0, 255, 1, 0, 0, 1, 3, 0, 0, 106, 24, 0, 16, 38, 24, 24, 1, 120, 24, 3, 0, 1, 4, 251, 255, 139, 4, 0, 0, 106, 24, 0, 4, 106, 5, 24, 20, 1, 6, 5, 0, 1, 7, 0, 0, 1, 8, 0, 0, 1, 9, 0, 0, 3, 10, 1, 7, 4, 11, 2, 7, 106, 12, 0, 32, 121, 12, 10, 0, 19, 25, 12, 23, 106, 26, 0, 36, 135, 24, 197, 0, 25, 26, 0, 0, 121, 24, 5, 0, 2, 4, 0, 0, 187, 167, 182, 171, 1, 3, 18, 0, 119, 0, 116, 0, 19, 24, 5, 22, 135, 13, 216, 0, 24, 0, 10, 11, 32, 24, 13, 252, 120, 24, 241, 255, 106, 24, 0, 16, 38, 24, 24, 8, 121, 24, 4, 0, 0, 4, 13, 0, 1, 3, 18, 0, 119, 0, 105, 0, 34, 24, 13, 245, 121, 24, 10, 0, 2, 24, 0, 0, 187, 176, 185, 223, 1, 25, 1, 0, 138, 13, 24, 25, 68, 60, 1, 0, 1, 3, 16, 0, 119, 0, 63, 0, 1, 3, 15, 0, 119, 0, 94, 0, 1, 24, 245, 255, 1, 25, 1, 0, 138, 13, 24, 25, 100, 60, 1, 0, 1, 3, 16, 0, 119, 0, 55, 0, 119, 0, 1, 0, 121, 6, 6, 0, 1, 14, 0, 0, 26, 15, 6, 1, 0, 16, 8, 0, 0, 17, 9, 0, 119, 0, 48, 0, 106, 25, 0, 40, 32, 25, 25, 0, 121, 25, 6, 0, 25, 25, 0, 40, 106, 25, 25, 4, 32, 25, 25, 0, 0, 24, 25, 0, 119, 0, 3, 0, 1, 25, 0, 0, 0, 24, 25, 0, 121, 24, 4, 0, 0, 18, 8, 0, 0, 19, 9, 0, 119, 0, 27, 0, 135, 11, 1, 0, 135, 10, 2, 0, 32, 24, 8, 0, 32, 25, 9, 0, 19, 24, 24, 25, 121, 24, 4, 0, 0, 18, 11, 0, 0, 19, 10, 0, 119, 0, 18, 0, 106, 24, 0, 40, 25, 25, 0, 40, 106, 25, 25, 4, 135, 12, 44, 0, 24, 25, 8, 9, 135, 20, 2, 0, 15, 25, 20, 10, 13, 24, 10, 20, 16, 26, 12, 11, 19, 24, 24, 26, 20, 25, 25, 24, 121, 25, 4, 0, 1, 4, 251, 255, 1, 3, 18, 0, 119, 0, 43, 0, 0, 18, 8, 0, 0, 19, 9, 0, 1, 24, 232, 3, 135, 25, 35, 0, 24, 0, 0, 0, 1, 14, 0, 0, 1, 15, 0, 0, 0, 16, 18, 0, 0, 17, 19, 0, 32, 25, 3, 16, 121, 25, 11, 0, 1, 3, 0, 0, 34, 25, 13, 0, 121, 25, 4, 0, 0, 4, 13, 0, 1, 3, 18, 0, 119, 0, 26, 0, 0, 14, 13, 0, 0, 15, 6, 0, 0, 16, 8, 0, 0, 17, 9, 0, 32, 12, 14, 0, 3, 11, 14, 7, 34, 25, 11, 1, 121, 25, 15, 0, 1, 25, 2, 0, 15, 25, 25, 15, 20, 25, 12, 25, 1, 24, 2, 0, 125, 6, 25, 15, 24, 0, 0, 0, 0, 7, 11, 0, 1, 24, 0, 0, 125, 8, 12, 16, 24, 0, 0, 0, 1, 24, 0, 0, 125, 9, 12, 17, 24, 0, 0, 0, 119, 0, 132, 255, 0, 4, 11, 0, 1, 3, 18, 0, 119, 0, 1, 0, 32, 24, 3, 15, 121, 24, 7, 0, 1, 24, 0, 0, 15, 24, 24, 7, 125, 4, 24, 7, 21, 0, 0, 0, 139, 4, 0, 0, 119, 0, 4, 0, 32, 24, 3, 18, 121, 24, 2, 0, 139, 4, 0, 0, 1, 24, 0, 0, 139, 24, 0, 0, 140, 2, 16, 0, 0, 0, 0, 0, 2, 8, 0, 0, 1, 111, 16, 0, 2, 9, 0, 0, 0, 111, 16, 0, 2, 10, 0, 0, 153, 18, 10, 0, 136, 11, 0, 0, 0, 2, 11, 0, 136, 11, 0, 0, 1, 12, 0, 1, 3, 11, 11, 12, 137, 11, 0, 0, 1, 11, 176, 0, 3, 3, 2, 11, 25, 4, 3, 80, 1, 11, 0, 0, 85, 3, 11, 0, 25, 3, 3, 4, 54, 11, 3, 4, 56, 62, 1, 0, 1, 11, 176, 0, 3, 11, 2, 11, 1, 12, 192, 77, 1, 13, 0, 92, 1, 14, 2, 0, 135, 3, 219, 0, 11, 0, 1, 12, 13, 14, 0, 0, 34, 14, 3, 0, 121, 14, 11, 0, 1, 13, 0, 0, 1, 12, 8, 0, 2, 11, 0, 0, 52, 18, 10, 0, 1, 15, 128, 0, 3, 15, 2, 15, 135, 14, 5, 0, 13, 12, 11, 15, 0, 5, 3, 0, 119, 0, 101, 0, 1, 14, 0, 0, 1, 15, 176, 0, 3, 15, 2, 15, 135, 1, 218, 0, 14, 15, 0, 0, 34, 15, 1, 0, 121, 15, 11, 0, 1, 14, 0, 0, 1, 11, 8, 0, 2, 12, 0, 0, 88, 18, 10, 0, 1, 13, 136, 0, 3, 13, 2, 13, 135, 15, 5, 0, 14, 11, 12, 13, 0, 5, 1, 0, 119, 0, 84, 0, 135, 15, 220, 0, 1, 15, 176, 0, 3, 15, 2, 15, 106, 15, 15, 36, 25, 15, 15, 12, 2, 13, 0, 0, 119, 18, 10, 0, 1, 12, 80, 0, 134, 1, 0, 0, 168, 55, 1, 0, 15, 13, 12, 0, 34, 12, 1, 0, 121, 12, 11, 0, 1, 13, 0, 0, 1, 15, 8, 0, 2, 11, 0, 0, 125, 18, 10, 0, 1, 14, 144, 0, 3, 14, 2, 14, 135, 12, 5, 0, 13, 15, 11, 14, 0, 5, 1, 0, 119, 0, 61, 0, 1, 12, 0, 0, 2, 14, 0, 0, 4, 188, 65, 0, 82, 14, 14, 0, 47, 12, 12, 14, 184, 63, 1, 0, 1, 1, 0, 0, 2, 12, 0, 0, 0, 188, 65, 0, 82, 12, 12, 0, 41, 14, 1, 2, 94, 12, 12, 14, 135, 6, 221, 0, 12, 0, 0, 0, 25, 1, 1, 1, 34, 12, 6, 0, 120, 12, 7, 0, 2, 12, 0, 0, 4, 188, 65, 0, 82, 12, 12, 0, 56, 12, 12, 1, 184, 63, 1, 0, 119, 0, 241, 255, 1, 14, 0, 0, 1, 11, 8, 0, 1, 15, 152, 0, 3, 15, 2, 15, 135, 12, 5, 0, 14, 11, 10, 15, 0, 5, 6, 0, 119, 0, 30, 0, 1, 12, 176, 0, 3, 12, 2, 12, 106, 12, 12, 36, 2, 15, 0, 0, 190, 18, 10, 0, 1, 11, 81, 0, 134, 1, 0, 0, 168, 55, 1, 0, 12, 15, 11, 0, 34, 11, 1, 0, 121, 11, 11, 0, 1, 15, 0, 0, 1, 12, 8, 0, 2, 14, 0, 0, 197, 18, 10, 0, 1, 13, 160, 0, 3, 13, 2, 13, 135, 11, 5, 0], eb + 71680);
                HEAPU8.set([15, 12, 14, 13, 0, 5, 1, 0, 119, 0, 9, 0, 135, 11, 222, 0, 1, 13, 176, 0, 3, 13, 2, 13, 135, 11, 223, 0, 13, 0, 0, 0, 0, 7, 1, 0, 137, 2, 0, 0, 139, 7, 0, 0, 1, 13, 176, 0, 3, 13, 2, 13, 135, 11, 223, 0, 13, 0, 0, 0, 1, 13, 128, 0, 135, 11, 11, 0, 5, 2, 13, 0, 1, 11, 168, 0, 97, 2, 11, 2, 1, 13, 0, 0, 1, 14, 8, 0, 2, 12, 0, 0, 40, 69, 13, 0, 1, 15, 168, 0, 3, 15, 2, 15, 135, 11, 5, 0, 13, 14, 12, 15, 0, 7, 5, 0, 137, 2, 0, 0, 139, 7, 0, 0, 140, 3, 22, 0, 0, 0, 0, 0, 2, 17, 0, 0, 128, 240, 250, 2, 1, 3, 0, 0, 106, 4, 1, 56, 25, 18, 1, 56, 106, 5, 18, 4, 106, 6, 1, 28, 0, 7, 2, 0, 0, 2, 6, 0, 2, 18, 0, 0, 64, 75, 76, 0, 47, 18, 18, 7, 240, 64, 1, 0, 135, 8, 224, 0, 0, 7, 0, 0, 25, 19, 0, 88, 106, 19, 19, 4, 34, 19, 19, 0, 121, 19, 6, 0, 15, 20, 8, 17, 125, 19, 20, 8, 17, 0, 0, 0, 0, 18, 19, 0, 119, 0, 2, 0, 0, 18, 8, 0, 0, 9, 18, 0, 119, 0, 2, 0, 0, 9, 7, 0, 135, 8, 225, 0, 1, 9, 0, 0, 34, 18, 8, 0, 121, 18, 4, 0, 0, 10, 8, 0, 1, 3, 7, 0, 119, 0, 18, 0, 106, 18, 1, 24, 3, 18, 18, 2, 134, 11, 0, 0, 112, 52, 1, 0, 0, 18, 9, 0, 46, 18, 11, 9, 52, 65, 1, 0, 1, 3, 6, 0, 119, 0, 9, 0, 4, 8, 7, 9, 36, 18, 8, 0, 121, 18, 3, 0, 0, 12, 9, 0, 119, 0, 4, 0, 0, 7, 8, 0, 106, 2, 1, 28, 119, 0, 214, 255, 32, 18, 3, 6, 121, 18, 11, 0, 1, 20, 0, 0, 15, 20, 20, 11, 1, 21, 0, 0, 125, 19, 20, 11, 21, 0, 0, 0, 3, 19, 19, 2, 135, 18, 226, 0, 1, 19, 0, 0, 0, 10, 11, 0, 1, 3, 7, 0, 32, 18, 3, 7, 121, 18, 10, 0, 1, 18, 0, 0, 47, 18, 18, 7, 172, 65, 1, 0, 106, 19, 1, 36, 39, 19, 19, 2, 109, 1, 36, 19, 0, 12, 10, 0, 119, 0, 2, 0, 0, 12, 10, 0, 109, 1, 56, 4, 25, 19, 1, 56, 109, 19, 4, 5, 106, 5, 1, 28, 121, 5, 7, 0, 0, 13, 5, 0, 15, 14, 6, 13, 4, 15, 13, 6, 125, 16, 14, 15, 12, 0, 0, 0, 139, 16, 0, 0, 135, 19, 60, 0, 1, 0, 0, 0, 106, 13, 1, 28, 15, 14, 6, 13, 4, 15, 13, 6, 125, 16, 14, 15, 12, 0, 0, 0, 139, 16, 0, 0, 140, 3, 10, 0, 0, 0, 0, 0, 106, 3, 0, 8, 106, 0, 3, 12, 15, 7, 0, 2, 125, 4, 7, 0, 2, 0, 0, 0, 106, 2, 3, 4, 120, 2, 4, 0, 135, 5, 227, 0, 1, 4, 0, 0, 119, 0, 3, 0, 135, 5, 22, 0, 2, 1, 4, 0, 1, 8, 255, 255, 1, 9, 2, 0, 138, 5, 8, 9, 84, 66, 1, 0, 108, 66, 1, 0, 0, 6, 5, 0, 139, 6, 0, 0, 119, 0, 16, 0, 135, 3, 78, 0, 1, 9, 0, 0, 82, 8, 3, 0, 4, 6, 9, 8, 139, 6, 0, 0, 119, 0, 248, 255, 106, 7, 3, 16, 32, 7, 7, 0, 2, 8, 0, 0, 187, 176, 185, 223, 1, 9, 245, 255, 125, 6, 7, 8, 9, 0, 0, 0, 139, 6, 0, 0, 119, 0, 242, 255, 1, 8, 0, 0, 139, 8, 0, 0, 140, 3, 8, 0, 0, 0, 0, 0, 135, 5, 63, 0, 1, 0, 0, 0, 1, 6, 0, 0, 109, 1, 24, 6, 1, 5, 0, 0, 109, 1, 28, 5, 1, 5, 0, 0, 1, 6, 0, 0, 1, 7, 1, 0, 135, 3, 33, 0, 0, 5, 6, 7, 135, 4, 2, 0, 109, 1, 56, 3, 25, 7, 1, 56, 109, 7, 4, 4, 134, 7, 0, 0, 124, 64, 1, 0, 0, 1, 2, 0, 139, 7, 0, 0, 140, 4, 8, 0, 0, 0, 0, 0, 106, 5, 0, 16, 1, 6, 140, 4, 3, 6, 0, 6, 1, 7, 0, 0, 134, 4, 0, 0, 100, 223, 0, 0, 5, 6, 0, 1, 2, 3, 7, 0, 139, 0, 0, 0, 140, 3, 5, 0, 0, 0, 0, 0, 82, 4, 0, 0, 134, 3, 0, 0, 112, 59, 1, 0, 4, 1, 2, 0, 139, 3, 0, 0, 0, 0, 0, 0], eb + 81920);
                var relocations = [];
                relocations = relocations.concat([108, 180, 248, 260, 292, 372, 396, 428, 440, 464, 524, 592, 624, 656, 812, 1276, 1444, 1552, 1604, 1792, 1852, 1904, 2016, 2064, 2212, 2240, 2252, 2276, 2416, 2492, 2540, 2732, 2848, 2880, 2912, 3052, 3364, 3900, 4288, 4472, 4476, 4480, 4484, 4488, 4492, 4496, 4500, 4504, 4508, 4512, 4516, 4520, 4524, 4528, 4532, 4536, 4540, 4544, 4548, 4552, 4556, 4560, 4564, 4568, 4572, 4576, 4580, 4584, 4588, 4592, 4596, 4600, 4604, 4608, 4612, 4616, 4620, 4624, 4628, 4632, 4636, 4640, 4644, 4648, 4652, 4656, 4660, 4664, 4668, 4672, 4676, 4680, 4684, 4688, 4692, 4696, 4700, 4704, 4708, 4712, 4716, 4720, 4724, 4728, 4732, 4736, 4740, 4744, 4748, 4752, 4756, 4760, 4780, 4784, 4936, 5008, 5080, 5084, 5088, 5092, 5224, 5668, 5868, 5900, 5984, 6008, 6272, 6344, 6416, 6420, 6424, 6428, 6640, 6692, 6744, 6768, 6816, 7268, 7288, 7356, 7388, 7732, 7756, 7792, 8088, 8276, 8312, 8336, 8408, 8444, 8488, 8524, 8596, 8656, 8684, 8804, 8892, 9024, 9068, 9416, 9448, 9480, 9636, 9724, 9756, 9816, 9884, 10048, 10080, 10160, 10244, 10276, 10392, 10516, 10988, 11056, 11240, 11616, 11676, 11728, 11916, 11956, 12016, 12072, 12140, 12172, 12228, 12352, 12364, 12380, 12420, 12464, 12488, 12536, 12624, 12996, 13160, 13352, 13516, 13708, 13868, 14068, 14228, 14428, 14616, 15128, 15680, 16544, 17608, 18860, 19144, 19164, 20276, 20516, 20676, 20876, 21036, 21236, 21424, 21832, 21992, 22012, 22164, 22256, 22316, 22404, 22476, 22492, 22564, 23040, 23196, 23280, 23292, 23340, 23444, 23548, 23576, 23604, 23632, 23664, 23760, 23868, 23900, 24104, 24264, 24332, 24480, 24528, 24532, 24576, 24580, 24896, 25124, 25140, 25200, 25304, 25408, 25436, 25524, 25556, 25748, 25904, 26024, 26088, 26216, 26264, 26352, 26452, 26616, 26848, 27508, 27512, 27516, 27520, 27608, 27788, 27792, 27796, 27800, 27872, 28e3, 28004, 28008, 28012, 28176, 28556, 28696, 29084, 29112, 29116, 29120, 29124, 29128, 29132, 29136, 29140, 29144, 29148, 29152, 29156, 29160, 29164, 29168, 29172, 29176, 29180, 29184, 29188, 29192, 29196, 29200, 29204, 29208, 29212, 29216, 29220, 29224, 29228, 29232, 29236, 29240, 29244, 29248, 29252, 29256, 29260, 29264, 29268, 29272, 29276, 29280, 29284, 29288, 29292, 29296, 29300, 29304, 29308, 29312, 29316, 29320, 29324, 29328, 29332, 29336, 29340, 29344, 29348, 29352, 29356, 29360, 29364, 29368, 29372, 29376, 29380, 29384, 29388, 29392, 29396, 29400, 29404, 29408, 29412, 29416, 29420, 29424, 29428, 29432, 29436, 29440, 29444, 29448, 29452, 29456, 29460, 29464, 29468, 29472, 29476, 29480, 29484, 29488, 29492, 29496, 29500, 29504, 29508, 29512, 29516, 29520, 29524, 29528, 29532, 29536, 29540, 29544, 29548, 29552, 29556, 29560, 29564, 29568, 29572, 29576, 29580, 29584, 29588, 29592, 29596, 29600, 29604, 29608, 29612, 29616, 29620, 29624, 29628, 29632, 29636, 29640, 29644, 29648, 29652, 29656, 29660, 29664, 29668, 29672, 29676, 29680, 29684, 29688, 29692, 29696, 29700, 29704, 29708, 29712, 29716, 29720, 29724, 29728, 29732, 29736, 29740, 29744, 29748, 29752, 29756, 29760, 29764, 29768, 29772, 29776, 29780, 29784, 29788, 29792, 29796, 30028, 30208, 30348, 30388, 30460, 30672, 30968, 31084, 31692, 31708, 31724, 31872, 32252, 33012, 33432, 33752, 33780, 33852, 33932, 34388, 34424, 34592, 34644, 34680, 34784, 34812, 34952, 34956, 34960, 34964, 35124, 35200, 35492, 35536, 35552, 35568, 35592, 35628, 35736, 35800, 35968, 36016, 36148, 36220, 36224, 36296, 36680, 36692, 36776, 36808, 36844, 37092, 37152, 37184, 37220, 37420, 37964, 37968, 37972, 37976, 37980, 37984, 37988, 37992, 38072, 38320, 38824, 39144, 39148, 39152, 39156, 39160, 39164, 39168, 39172, 39176, 39180, 39184, 39188, 40124, 40144, 40224, 40460, 40528, 40660, 40860, 41296, 41992, 42008, 42108, 42132, 42460, 42496, 42576, 43068, 43528, 43748, 44012, 44304, 44764, 44812, 44832, 44904, 45040, 45356, 45404, 45424, 45496, 45636, 45924, 46216, 46252, 46280, 46484, 47892, 47964, 47984, 48056, 48076, 48148, 48168, 48240, 49076, 49260, 49300, 49348, 49476, 49576, 49616, 50004, 50444, 50564, 50972, 51008, 51064, 51096, 51136, 51204, 51224, 51272, 51348, 51484, 51524, 51580, 51676, 51768, 51808, 51876, 51896, 51940, 52004, 52208, 52212, 52216, 52220, 52224, 52228, 52372, 52412, 52468, 52548, 52588, 52656, 52672, 52712, 52768, 52976, 53016, 53072, 53132, 53172, 53228, 53332, 53400, 53440, 53508, 53564, 53604, 53672, 53732, 53796, 53900, 53928, 53932, 53936, 53940, 53944, 53948, 53952, 53956, 53960, 53964, 53968, 53972, 53976, 53980, 53984, 53988, 53992, 53996, 54e3, 54004, 54008, 54012, 54016, 54020, 54024, 54028, 54032, 54036, 54040, 54044, 54048, 54052, 54056, 54060, 54064, 54068, 54072, 54076, 54080, 54084, 54088, 54092, 54096, 54100, 54104, 54108, 54112, 54116, 54120, 54124, 54128, 54132, 54136, 54140, 54144, 54148, 54152, 54156, 54160, 54164, 54168, 54172, 54176, 54180, 54184, 54188, 54192, 54196, 54200, 54204, 54208, 54212, 54216, 54220, 54224, 54228, 54232, 54236, 54240, 54244, 54248, 54252, 54256, 54260, 54264, 54268, 54272, 54276, 54280, 54284, 54288, 54292, 54296, 54300, 54304, 54308, 54312, 54316, 54320, 54324, 54328, 54332, 54336, 54340, 54344, 54348, 54352, 54356, 54360, 54364, 54368, 54372, 54376, 54380, 54384, 54388, 54392, 54396, 54400, 54404, 54408, 54412, 54416, 54420, 54424, 54428, 54432, 54436, 54440, 54444, 54448, 54452, 54456, 54460, 54464, 54468, 54472, 54476, 54480, 54484, 54488, 54492, 54496, 54500, 54504, 54508, 54512, 54516, 54520, 54524, 54528, 54532, 54536, 54540, 54544, 54548, 54552, 55864, 56028, 56928, 56948, 56980, 57080, 57148, 57556, 57588, 58020, 58024, 58028, 58560, 58656, 59644, 60100, 60180, 60248, 60852, 61280, 62400, 62640, 63016, 63160, 63244, 63300, 63324, 63448, 63940, 63952, 63964, 64080, 64132, 64144, 64172, 64268, 64320, 64380, 64400, 64424, 64492, 64528, 64588, 64608, 64632, 64716, 64720, 64936, 65088, 65156, 65168, 65180, 65240, 66276, 66280, 66284, 66288, 66608, 66824, 67152, 67412, 67488, 67728, 67888, 68312, 68316, 68320, 68324, 68328, 68332, 68408, 68616, 68804, 68828, 68932, 69384, 69544, 69692, 69756, 70152, 70172, 70356, 70360, 70380, 70616, 70768, 70976, 71140, 71584, 71828, 72240, 72524, 72528, 72532, 72536, 72540, 72696, 72824, 72836, 72940, 74584, 75328, 75620, 75692, 76096, 76652, 76716, 76732, 76808, 76880, 77104, 77128, 77212, 77260, 77284, 77328, 77352, 77384, 77412, 77548, 77900, 79016, 79152, 79248, 79280, 79492, 79528, 79648, 80244, 80272, 80348, 80396, 80440, 80564, 80952, 80984, 81480, 81744, 81808, 82100, 82216, 82324, 82496, 82500, 10100, 11936, 30520, 39124, 49040, 49560, 57516, 58588, 58892, 59272, 59588, 60088, 60460, 66968, 71512, 72304, 77652, 78152, 81668, 81876, 82204, 82656, 82696, 82728]);
                for (var i = 0; i < relocations.length; i++) {
                    HEAPU32[eb + relocations[i] >> 2] = HEAPU32[eb + relocations[i] >> 2] + eb
                }
            });

            function ___assert_fail(condition, filename, line, func) {
                abort("Assertion failed: " + UTF8ToString(condition) + ", at: " + [filename ? UTF8ToString(filename) : "unknown filename", line, func ? UTF8ToString(func) : "unknown function"])
            }

            var ENV = {};

            function ___buildEnvironment(environ) {
                var MAX_ENV_VALUES = 64;
                var TOTAL_ENV_SIZE = 1024;
                var poolPtr;
                var envPtr;
                if (!___buildEnvironment.called) {
                    ___buildEnvironment.called = true;
                    ENV["USER"] = ENV["LOGNAME"] = "web_user";
                    ENV["PATH"] = "/";
                    ENV["PWD"] = "/";
                    ENV["HOME"] = "/home/web_user";
                    ENV["LANG"] = "C.UTF-8";
                    ENV["_"] = Module["thisProgram"];
                    poolPtr = getMemory(TOTAL_ENV_SIZE);
                    envPtr = getMemory(MAX_ENV_VALUES * 4);
                    HEAP32[envPtr >> 2] = poolPtr;
                    HEAP32[environ >> 2] = envPtr
                } else {
                    envPtr = HEAP32[environ >> 2];
                    poolPtr = HEAP32[envPtr >> 2]
                }
                var strings = [];
                var totalSize = 0;
                for (var key in ENV) {
                    if (typeof ENV[key] === "string") {
                        var line = key + "=" + ENV[key];
                        strings.push(line);
                        totalSize += line.length
                    }
                }
                if (totalSize > TOTAL_ENV_SIZE) {
                    throw new Error("Environment size exceeded TOTAL_ENV_SIZE!")
                }
                var ptrSize = 4;
                for (var i = 0; i < strings.length; i++) {
                    var line = strings[i];
                    writeAsciiToMemory(line, poolPtr);
                    HEAP32[envPtr + i * ptrSize >> 2] = poolPtr;
                    poolPtr += line.length + 1
                }
                HEAP32[envPtr + strings.length * ptrSize >> 2] = 0
            }

            function _llvm_cttz_i32(x) {
                x = x | 0;
                return (x ? 31 - (Math_clz32(x ^ x - 1) | 0) | 0 : 32) | 0
            }

            function ___lock() {
            }

            function ___setErrNo(value) {
                if (Module["___errno_location"]) HEAP32[Module["___errno_location"]() >> 2] = value;
                return value
            }

            var PATH = {
                splitPath: function (filename) {
                    var splitPathRe = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
                    return splitPathRe.exec(filename).slice(1)
                }, normalizeArray: function (parts, allowAboveRoot) {
                    var up = 0;
                    for (var i = parts.length - 1; i >= 0; i--) {
                        var last = parts[i];
                        if (last === ".") {
                            parts.splice(i, 1)
                        } else if (last === "..") {
                            parts.splice(i, 1);
                            up++
                        } else if (up) {
                            parts.splice(i, 1);
                            up--
                        }
                    }
                    if (allowAboveRoot) {
                        for (; up; up--) {
                            parts.unshift("..")
                        }
                    }
                    return parts
                }, normalize: function (path) {
                    var isAbsolute = path.charAt(0) === "/", trailingSlash = path.substr(-1) === "/";
                    path = PATH.normalizeArray(path.split("/").filter(function (p) {
                        return !!p
                    }), !isAbsolute).join("/");
                    if (!path && !isAbsolute) {
                        path = "."
                    }
                    if (path && trailingSlash) {
                        path += "/"
                    }
                    return (isAbsolute ? "/" : "") + path
                }, dirname: function (path) {
                    var result = PATH.splitPath(path), root = result[0], dir = result[1];
                    if (!root && !dir) {
                        return "."
                    }
                    if (dir) {
                        dir = dir.substr(0, dir.length - 1)
                    }
                    return root + dir
                }, basename: function (path) {
                    if (path === "/") return "/";
                    var lastSlash = path.lastIndexOf("/");
                    if (lastSlash === -1) return path;
                    return path.substr(lastSlash + 1)
                }, extname: function (path) {
                    return PATH.splitPath(path)[3]
                }, join: function () {
                    var paths = Array.prototype.slice.call(arguments, 0);
                    return PATH.normalize(paths.join("/"))
                }, join2: function (l, r) {
                    return PATH.normalize(l + "/" + r)
                }, resolve: function () {
                    var resolvedPath = "", resolvedAbsolute = false;
                    for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
                        var path = i >= 0 ? arguments[i] : FS.cwd();
                        if (typeof path !== "string") {
                            throw new TypeError("Arguments to path.resolve must be strings")
                        } else if (!path) {
                            return ""
                        }
                        resolvedPath = path + "/" + resolvedPath;
                        resolvedAbsolute = path.charAt(0) === "/"
                    }
                    resolvedPath = PATH.normalizeArray(resolvedPath.split("/").filter(function (p) {
                        return !!p
                    }), !resolvedAbsolute).join("/");
                    return (resolvedAbsolute ? "/" : "") + resolvedPath || "."
                }, relative: function (from, to) {
                    from = PATH.resolve(from).substr(1);
                    to = PATH.resolve(to).substr(1);

                    function trim(arr) {
                        var start = 0;
                        for (; start < arr.length; start++) {
                            if (arr[start] !== "") break
                        }
                        var end = arr.length - 1;
                        for (; end >= 0; end--) {
                            if (arr[end] !== "") break
                        }
                        if (start > end) return [];
                        return arr.slice(start, end - start + 1)
                    }

                    var fromParts = trim(from.split("/"));
                    var toParts = trim(to.split("/"));
                    var length = Math.min(fromParts.length, toParts.length);
                    var samePartsLength = length;
                    for (var i = 0; i < length; i++) {
                        if (fromParts[i] !== toParts[i]) {
                            samePartsLength = i;
                            break
                        }
                    }
                    var outputParts = [];
                    for (var i = samePartsLength; i < fromParts.length; i++) {
                        outputParts.push("..")
                    }
                    outputParts = outputParts.concat(toParts.slice(samePartsLength));
                    return outputParts.join("/")
                }
            };
            var TTY = {
                ttys: [], init: function () {
                }, shutdown: function () {
                }, register: function (dev, ops) {
                    TTY.ttys[dev] = {input: [], output: [], ops: ops};
                    FS.registerDevice(dev, TTY.stream_ops)
                }, stream_ops: {
                    open: function (stream) {
                        var tty = TTY.ttys[stream.node.rdev];
                        if (!tty) {
                            throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
                        }
                        stream.tty = tty;
                        stream.seekable = false
                    }, close: function (stream) {
                        stream.tty.ops.flush(stream.tty)
                    }, flush: function (stream) {
                        stream.tty.ops.flush(stream.tty)
                    }, read: function (stream, buffer, offset, length, pos) {
                        if (!stream.tty || !stream.tty.ops.get_char) {
                            throw new FS.ErrnoError(ERRNO_CODES.ENXIO)
                        }
                        var bytesRead = 0;
                        for (var i = 0; i < length; i++) {
                            var result;
                            try {
                                result = stream.tty.ops.get_char(stream.tty)
                            } catch (e) {
                                throw new FS.ErrnoError(ERRNO_CODES.EIO)
                            }
                            if (result === undefined && bytesRead === 0) {
                                throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)
                            }
                            if (result === null || result === undefined) break;
                            bytesRead++;
                            buffer[offset + i] = result
                        }
                        if (bytesRead) {
                            stream.node.timestamp = Date.now()
                        }
                        return bytesRead
                    }, write: function (stream, buffer, offset, length, pos) {
                        if (!stream.tty || !stream.tty.ops.put_char) {
                            throw new FS.ErrnoError(ERRNO_CODES.ENXIO)
                        }
                        try {
                            for (var i = 0; i < length; i++) {
                                stream.tty.ops.put_char(stream.tty, buffer[offset + i])
                            }
                        } catch (e) {
                            throw new FS.ErrnoError(ERRNO_CODES.EIO)
                        }
                        if (length) {
                            stream.node.timestamp = Date.now()
                        }
                        return i
                    }
                }, default_tty_ops: {
                    get_char: function (tty) {
                        if (!tty.input.length) {
                            var result = null;
                            if (ENVIRONMENT_IS_NODE) {
                                var BUFSIZE = 256;
                                var buf = new Buffer(BUFSIZE);
                                var bytesRead = 0;
                                var isPosixPlatform = process.platform != "win32";
                                var fd = process.stdin.fd;
                                if (isPosixPlatform) {
                                    var usingDevice = false;
                                    try {
                                        fd = fs.openSync("/dev/stdin", "r");
                                        usingDevice = true
                                    } catch (e) {
                                    }
                                }
                                try {
                                    bytesRead = fs.readSync(fd, buf, 0, BUFSIZE, null)
                                } catch (e) {
                                    if (e.toString().indexOf("EOF") != -1) bytesRead = 0; else throw e
                                }
                                if (usingDevice) {
                                    fs.closeSync(fd)
                                }
                                if (bytesRead > 0) {
                                    result = buf.slice(0, bytesRead).toString("utf-8")
                                } else {
                                    result = null
                                }
                            } else if (typeof window != "undefined" && typeof window.prompt == "function") {
                                result = window.prompt("Input: ");
                                if (result !== null) {
                                    result += "\n"
                                }
                            } else if (typeof readline == "function") {
                                result = readline();
                                if (result !== null) {
                                    result += "\n"
                                }
                            }
                            if (!result) {
                                return null
                            }
                            tty.input = intArrayFromString(result, true)
                        }
                        return tty.input.shift()
                    }, put_char: function (tty, val) {
                        if (val === null || val === 10) {
                            out(UTF8ArrayToString(tty.output, 0));
                            tty.output = []
                        } else {
                            if (val != 0) tty.output.push(val)
                        }
                    }, flush: function (tty) {
                        if (tty.output && tty.output.length > 0) {
                            out(UTF8ArrayToString(tty.output, 0));
                            tty.output = []
                        }
                    }
                }, default_tty1_ops: {
                    put_char: function (tty, val) {
                        if (val === null || val === 10) {
                            err(UTF8ArrayToString(tty.output, 0));
                            tty.output = []
                        } else {
                            if (val != 0) tty.output.push(val)
                        }
                    }, flush: function (tty) {
                        if (tty.output && tty.output.length > 0) {
                            err(UTF8ArrayToString(tty.output, 0));
                            tty.output = []
                        }
                    }
                }
            };
            var MEMFS = {
                ops_table: null, mount: function (mount) {
                    return MEMFS.createNode(null, "/", 16384 | 511, 0)
                }, createNode: function (parent, name, mode, dev) {
                    if (FS.isBlkdev(mode) || FS.isFIFO(mode)) {
                        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
                    }
                    if (!MEMFS.ops_table) {
                        MEMFS.ops_table = {
                            dir: {
                                node: {
                                    getattr: MEMFS.node_ops.getattr,
                                    setattr: MEMFS.node_ops.setattr,
                                    lookup: MEMFS.node_ops.lookup,
                                    mknod: MEMFS.node_ops.mknod,
                                    rename: MEMFS.node_ops.rename,
                                    unlink: MEMFS.node_ops.unlink,
                                    rmdir: MEMFS.node_ops.rmdir,
                                    readdir: MEMFS.node_ops.readdir,
                                    symlink: MEMFS.node_ops.symlink
                                }, stream: {llseek: MEMFS.stream_ops.llseek}
                            },
                            file: {
                                node: {getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr},
                                stream: {
                                    llseek: MEMFS.stream_ops.llseek,
                                    read: MEMFS.stream_ops.read,
                                    write: MEMFS.stream_ops.write,
                                    allocate: MEMFS.stream_ops.allocate,
                                    mmap: MEMFS.stream_ops.mmap,
                                    msync: MEMFS.stream_ops.msync
                                }
                            },
                            link: {
                                node: {
                                    getattr: MEMFS.node_ops.getattr,
                                    setattr: MEMFS.node_ops.setattr,
                                    readlink: MEMFS.node_ops.readlink
                                }, stream: {}
                            },
                            chrdev: {
                                node: {getattr: MEMFS.node_ops.getattr, setattr: MEMFS.node_ops.setattr},
                                stream: FS.chrdev_stream_ops
                            }
                        }
                    }
                    var node = FS.createNode(parent, name, mode, dev);
                    if (FS.isDir(node.mode)) {
                        node.node_ops = MEMFS.ops_table.dir.node;
                        node.stream_ops = MEMFS.ops_table.dir.stream;
                        node.contents = {}
                    } else if (FS.isFile(node.mode)) {
                        node.node_ops = MEMFS.ops_table.file.node;
                        node.stream_ops = MEMFS.ops_table.file.stream;
                        node.usedBytes = 0;
                        node.contents = null
                    } else if (FS.isLink(node.mode)) {
                        node.node_ops = MEMFS.ops_table.link.node;
                        node.stream_ops = MEMFS.ops_table.link.stream
                    } else if (FS.isChrdev(node.mode)) {
                        node.node_ops = MEMFS.ops_table.chrdev.node;
                        node.stream_ops = MEMFS.ops_table.chrdev.stream
                    }
                    node.timestamp = Date.now();
                    if (parent) {
                        parent.contents[name] = node
                    }
                    return node
                }, getFileDataAsRegularArray: function (node) {
                    if (node.contents && node.contents.subarray) {
                        var arr = [];
                        for (var i = 0; i < node.usedBytes; ++i) arr.push(node.contents[i]);
                        return arr
                    }
                    return node.contents
                }, getFileDataAsTypedArray: function (node) {
                    if (!node.contents) return new Uint8Array;
                    if (node.contents.subarray) return node.contents.subarray(0, node.usedBytes);
                    return new Uint8Array(node.contents)
                }, expandFileStorage: function (node, newCapacity) {
                    var prevCapacity = node.contents ? node.contents.length : 0;
                    if (prevCapacity >= newCapacity) return;
                    var CAPACITY_DOUBLING_MAX = 1024 * 1024;
                    newCapacity = Math.max(newCapacity, prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2 : 1.125) | 0);
                    if (prevCapacity != 0) newCapacity = Math.max(newCapacity, 256);
                    var oldContents = node.contents;
                    node.contents = new Uint8Array(newCapacity);
                    if (node.usedBytes > 0) node.contents.set(oldContents.subarray(0, node.usedBytes), 0);
                    return
                }, resizeFileStorage: function (node, newSize) {
                    if (node.usedBytes == newSize) return;
                    if (newSize == 0) {
                        node.contents = null;
                        node.usedBytes = 0;
                        return
                    }
                    if (!node.contents || node.contents.subarray) {
                        var oldContents = node.contents;
                        node.contents = new Uint8Array(new ArrayBuffer(newSize));
                        if (oldContents) {
                            node.contents.set(oldContents.subarray(0, Math.min(newSize, node.usedBytes)))
                        }
                        node.usedBytes = newSize;
                        return
                    }
                    if (!node.contents) node.contents = [];
                    if (node.contents.length > newSize) node.contents.length = newSize; else while (node.contents.length < newSize) node.contents.push(0);
                    node.usedBytes = newSize
                }, node_ops: {
                    getattr: function (node) {
                        var attr = {};
                        attr.dev = FS.isChrdev(node.mode) ? node.id : 1;
                        attr.ino = node.id;
                        attr.mode = node.mode;
                        attr.nlink = 1;
                        attr.uid = 0;
                        attr.gid = 0;
                        attr.rdev = node.rdev;
                        if (FS.isDir(node.mode)) {
                            attr.size = 4096
                        } else if (FS.isFile(node.mode)) {
                            attr.size = node.usedBytes
                        } else if (FS.isLink(node.mode)) {
                            attr.size = node.link.length
                        } else {
                            attr.size = 0
                        }
                        attr.atime = new Date(node.timestamp);
                        attr.mtime = new Date(node.timestamp);
                        attr.ctime = new Date(node.timestamp);
                        attr.blksize = 4096;
                        attr.blocks = Math.ceil(attr.size / attr.blksize);
                        return attr
                    }, setattr: function (node, attr) {
                        if (attr.mode !== undefined) {
                            node.mode = attr.mode
                        }
                        if (attr.timestamp !== undefined) {
                            node.timestamp = attr.timestamp
                        }
                        if (attr.size !== undefined) {
                            MEMFS.resizeFileStorage(node, attr.size)
                        }
                    }, lookup: function (parent, name) {
                        throw FS.genericErrors[ERRNO_CODES.ENOENT]
                    }, mknod: function (parent, name, mode, dev) {
                        return MEMFS.createNode(parent, name, mode, dev)
                    }, rename: function (old_node, new_dir, new_name) {
                        if (FS.isDir(old_node.mode)) {
                            var new_node;
                            try {
                                new_node = FS.lookupNode(new_dir, new_name)
                            } catch (e) {
                            }
                            if (new_node) {
                                for (var i in new_node.contents) {
                                    throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)
                                }
                            }
                        }
                        delete old_node.parent.contents[old_node.name];
                        old_node.name = new_name;
                        new_dir.contents[new_name] = old_node;
                        old_node.parent = new_dir
                    }, unlink: function (parent, name) {
                        delete parent.contents[name]
                    }, rmdir: function (parent, name) {
                        var node = FS.lookupNode(parent, name);
                        for (var i in node.contents) {
                            throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)
                        }
                        delete parent.contents[name]
                    }, readdir: function (node) {
                        var entries = [".", ".."];
                        for (var key in node.contents) {
                            if (!node.contents.hasOwnProperty(key)) {
                                continue
                            }
                            entries.push(key)
                        }
                        return entries
                    }, symlink: function (parent, newname, oldpath) {
                        var node = MEMFS.createNode(parent, newname, 511 | 40960, 0);
                        node.link = oldpath;
                        return node
                    }, readlink: function (node) {
                        if (!FS.isLink(node.mode)) {
                            throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
                        }
                        return node.link
                    }
                }, stream_ops: {
                    read: function (stream, buffer, offset, length, position) {
                        var contents = stream.node.contents;
                        if (position >= stream.node.usedBytes) return 0;
                        var size = Math.min(stream.node.usedBytes - position, length);
                        if (size > 8 && contents.subarray) {
                            buffer.set(contents.subarray(position, position + size), offset)
                        } else {
                            for (var i = 0; i < size; i++) buffer[offset + i] = contents[position + i]
                        }
                        return size
                    }, write: function (stream, buffer, offset, length, position, canOwn) {
                        canOwn = false;
                        if (!length) return 0;
                        var node = stream.node;
                        node.timestamp = Date.now();
                        if (buffer.subarray && (!node.contents || node.contents.subarray)) {
                            if (canOwn) {
                                node.contents = buffer.subarray(offset, offset + length);
                                node.usedBytes = length;
                                return length
                            } else if (node.usedBytes === 0 && position === 0) {
                                node.contents = new Uint8Array(buffer.subarray(offset, offset + length));
                                node.usedBytes = length;
                                return length
                            } else if (position + length <= node.usedBytes) {
                                node.contents.set(buffer.subarray(offset, offset + length), position);
                                return length
                            }
                        }
                        MEMFS.expandFileStorage(node, position + length);
                        if (node.contents.subarray && buffer.subarray) node.contents.set(buffer.subarray(offset, offset + length), position); else {
                            for (var i = 0; i < length; i++) {
                                node.contents[position + i] = buffer[offset + i]
                            }
                        }
                        node.usedBytes = Math.max(node.usedBytes, position + length);
                        return length
                    }, llseek: function (stream, offset, whence) {
                        var position = offset;
                        if (whence === 1) {
                            position += stream.position
                        } else if (whence === 2) {
                            if (FS.isFile(stream.node.mode)) {
                                position += stream.node.usedBytes
                            }
                        }
                        if (position < 0) {
                            throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
                        }
                        return position
                    }, allocate: function (stream, offset, length) {
                        MEMFS.expandFileStorage(stream.node, offset + length);
                        stream.node.usedBytes = Math.max(stream.node.usedBytes, offset + length)
                    }, mmap: function (stream, buffer, offset, length, position, prot, flags) {
                        if (!FS.isFile(stream.node.mode)) {
                            throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
                        }
                        var ptr;
                        var allocated;
                        var contents = stream.node.contents;
                        if (!(flags & 2) && (contents.buffer === buffer || contents.buffer === buffer.buffer)) {
                            allocated = false;
                            ptr = contents.byteOffset
                        } else {
                            if (position > 0 || position + length < stream.node.usedBytes) {
                                if (contents.subarray) {
                                    contents = contents.subarray(position, position + length)
                                } else {
                                    contents = Array.prototype.slice.call(contents, position, position + length)
                                }
                            }
                            allocated = true;
                            ptr = _malloc(length);
                            if (!ptr) {
                                throw new FS.ErrnoError(ERRNO_CODES.ENOMEM)
                            }
                            buffer.set(contents, ptr)
                        }
                        return {ptr: ptr, allocated: allocated}
                    }, msync: function (stream, buffer, offset, length, mmapFlags) {
                        if (!FS.isFile(stream.node.mode)) {
                            throw new FS.ErrnoError(ERRNO_CODES.ENODEV)
                        }
                        if (mmapFlags & 2) {
                            return 0
                        }
                        var bytesWritten = MEMFS.stream_ops.write(stream, buffer, 0, length, offset, false);
                        return 0
                    }
                }
            };
            var IDBFS = {
                dbs: {}, indexedDB: function () {
                    if (typeof indexedDB !== "undefined") return indexedDB;
                    var ret = null;
                    if (typeof window === "object") ret = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
                    assert(ret, "IDBFS used, but indexedDB not supported");
                    return ret
                }, DB_VERSION: 21, DB_STORE_NAME: "FILE_DATA", mount: function (mount) {
                    return MEMFS.mount.apply(null, arguments)
                }, syncfs: function (mount, populate, callback) {
                    IDBFS.getLocalSet(mount, function (err, local) {
                        if (err) return callback(err);
                        IDBFS.getRemoteSet(mount, function (err, remote) {
                            if (err) return callback(err);
                            var src = populate ? remote : local;
                            var dst = populate ? local : remote;
                            IDBFS.reconcile(src, dst, callback)
                        })
                    })
                }, getDB: function (name, callback) {
                    var db = IDBFS.dbs[name];
                    if (db) {
                        return callback(null, db)
                    }
                    var req;
                    try {
                        req = IDBFS.indexedDB().open(name, IDBFS.DB_VERSION)
                    } catch (e) {
                        return callback(e)
                    }
                    if (!req) {
                        return callback("Unable to connect to IndexedDB")
                    }
                    req.onupgradeneeded = function (e) {
                        var db = e.target.result;
                        var transaction = e.target.transaction;
                        var fileStore;
                        if (db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)) {
                            fileStore = transaction.objectStore(IDBFS.DB_STORE_NAME)
                        } else {
                            fileStore = db.createObjectStore(IDBFS.DB_STORE_NAME)
                        }
                        if (!fileStore.indexNames.contains("timestamp")) {
                            fileStore.createIndex("timestamp", "timestamp", {unique: false})
                        }
                    };
                    req.onsuccess = function () {
                        db = req.result;
                        IDBFS.dbs[name] = db;
                        callback(null, db)
                    };
                    req.onerror = function (e) {
                        callback(this.error);
                        e.preventDefault()
                    }
                }, getLocalSet: function (mount, callback) {
                    var entries = {};

                    function isRealDir(p) {
                        return p !== "." && p !== ".."
                    }

                    function toAbsolute(root) {
                        return function (p) {
                            return PATH.join2(root, p)
                        }
                    }

                    var check = FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));
                    while (check.length) {
                        var path = check.pop();
                        var stat;
                        try {
                            stat = FS.stat(path)
                        } catch (e) {
                            return callback(e)
                        }
                        if (FS.isDir(stat.mode)) {
                            check.push.apply(check, FS.readdir(path).filter(isRealDir).map(toAbsolute(path)))
                        }
                        entries[path] = {timestamp: stat.mtime}
                    }
                    return callback(null, {type: "local", entries: entries})
                }, getRemoteSet: function (mount, callback) {
                    var entries = {};
                    IDBFS.getDB(mount.mountpoint, function (err, db) {
                        if (err) return callback(err);
                        try {
                            var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readonly");
                            transaction.onerror = function (e) {
                                callback(this.error);
                                e.preventDefault()
                            };
                            var store = transaction.objectStore(IDBFS.DB_STORE_NAME);
                            var index = store.index("timestamp");
                            index.openKeyCursor().onsuccess = function (event) {
                                var cursor = event.target.result;
                                if (!cursor) {
                                    return callback(null, {type: "remote", db: db, entries: entries})
                                }
                                entries[cursor.primaryKey] = {timestamp: cursor.key};
                                cursor.continue()
                            }
                        } catch (e) {
                            return callback(e)
                        }
                    })
                }, loadLocalEntry: function (path, callback) {
                    var stat, node;
                    try {
                        var lookup = FS.lookupPath(path);
                        node = lookup.node;
                        stat = FS.stat(path)
                    } catch (e) {
                        return callback(e)
                    }
                    if (FS.isDir(stat.mode)) {
                        return callback(null, {timestamp: stat.mtime, mode: stat.mode})
                    } else if (FS.isFile(stat.mode)) {
                        node.contents = MEMFS.getFileDataAsTypedArray(node);
                        return callback(null, {timestamp: stat.mtime, mode: stat.mode, contents: node.contents})
                    } else {
                        return callback(new Error("node type not supported"))
                    }
                }, storeLocalEntry: function (path, entry, callback) {
                    try {
                        if (FS.isDir(entry.mode)) {
                            FS.mkdir(path, entry.mode)
                        } else if (FS.isFile(entry.mode)) {
                            FS.writeFile(path, entry.contents, {canOwn: true})
                        } else {
                            return callback(new Error("node type not supported"))
                        }
                        FS.chmod(path, entry.mode);
                        FS.utime(path, entry.timestamp, entry.timestamp)
                    } catch (e) {
                        return callback(e)
                    }
                    callback(null)
                }, removeLocalEntry: function (path, callback) {
                    try {
                        var lookup = FS.lookupPath(path);
                        var stat = FS.stat(path);
                        if (FS.isDir(stat.mode)) {
                            FS.rmdir(path)
                        } else if (FS.isFile(stat.mode)) {
                            FS.unlink(path)
                        }
                    } catch (e) {
                        return callback(e)
                    }
                    callback(null)
                }, loadRemoteEntry: function (store, path, callback) {
                    var req = store.get(path);
                    req.onsuccess = function (event) {
                        callback(null, event.target.result)
                    };
                    req.onerror = function (e) {
                        callback(this.error);
                        e.preventDefault()
                    }
                }, storeRemoteEntry: function (store, path, entry, callback) {
                    var req = store.put(entry, path);
                    req.onsuccess = function () {
                        callback(null)
                    };
                    req.onerror = function (e) {
                        callback(this.error);
                        e.preventDefault()
                    }
                }, removeRemoteEntry: function (store, path, callback) {
                    var req = store.delete(path);
                    req.onsuccess = function () {
                        callback(null)
                    };
                    req.onerror = function (e) {
                        callback(this.error);
                        e.preventDefault()
                    }
                }, reconcile: function (src, dst, callback) {
                    var total = 0;
                    var create = [];
                    Object.keys(src.entries).forEach(function (key) {
                        var e = src.entries[key];
                        var e2 = dst.entries[key];
                        if (!e2 || e.timestamp > e2.timestamp) {
                            create.push(key);
                            total++
                        }
                    });
                    var remove = [];
                    Object.keys(dst.entries).forEach(function (key) {
                        var e = dst.entries[key];
                        var e2 = src.entries[key];
                        if (!e2) {
                            remove.push(key);
                            total++
                        }
                    });
                    if (!total) {
                        return callback(null)
                    }
                    var errored = false;
                    var completed = 0;
                    var db = src.type === "remote" ? src.db : dst.db;
                    var transaction = db.transaction([IDBFS.DB_STORE_NAME], "readwrite");
                    var store = transaction.objectStore(IDBFS.DB_STORE_NAME);

                    function done(err) {
                        if (err) {
                            if (!done.errored) {
                                done.errored = true;
                                return callback(err)
                            }
                            return
                        }
                        if (++completed >= total) {
                            return callback(null)
                        }
                    }

                    transaction.onerror = function (e) {
                        done(this.error);
                        e.preventDefault()
                    };
                    create.sort().forEach(function (path) {
                        if (dst.type === "local") {
                            IDBFS.loadRemoteEntry(store, path, function (err, entry) {
                                if (err) return done(err);
                                IDBFS.storeLocalEntry(path, entry, done)
                            })
                        } else {
                            IDBFS.loadLocalEntry(path, function (err, entry) {
                                if (err) return done(err);
                                IDBFS.storeRemoteEntry(store, path, entry, done)
                            })
                        }
                    });
                    remove.sort().reverse().forEach(function (path) {
                        if (dst.type === "local") {
                            IDBFS.removeLocalEntry(path, done)
                        } else {
                            IDBFS.removeRemoteEntry(store, path, done)
                        }
                    })
                }
            };
            var NODEFS = {
                isWindows: false, staticInit: function () {
                    NODEFS.isWindows = !!process.platform.match(/^win/);
                    var flags = process["binding"]("constants");
                    if (flags["fs"]) {
                        flags = flags["fs"]
                    }
                    NODEFS.flagsForNodeMap = {
                        1024: flags["O_APPEND"],
                        64: flags["O_CREAT"],
                        128: flags["O_EXCL"],
                        0: flags["O_RDONLY"],
                        2: flags["O_RDWR"],
                        4096: flags["O_SYNC"],
                        512: flags["O_TRUNC"],
                        1: flags["O_WRONLY"]
                    }
                }, bufferFrom: function (arrayBuffer) {
                    return Buffer.alloc ? Buffer.from(arrayBuffer) : new Buffer(arrayBuffer)
                }, mount: function (mount) {
                    assert(ENVIRONMENT_IS_NODE);
                    return NODEFS.createNode(null, "/", NODEFS.getMode(mount.opts.root), 0)
                }, createNode: function (parent, name, mode, dev) {
                    if (!FS.isDir(mode) && !FS.isFile(mode) && !FS.isLink(mode)) {
                        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
                    }
                    var node = FS.createNode(parent, name, mode);
                    node.node_ops = NODEFS.node_ops;
                    node.stream_ops = NODEFS.stream_ops;
                    return node
                }, getMode: function (path) {
                    var stat;
                    try {
                        stat = fs.lstatSync(path);
                        if (NODEFS.isWindows) {
                            stat.mode = stat.mode | (stat.mode & 292) >> 2
                        }
                    } catch (e) {
                        if (!e.code) throw e;
                        throw new FS.ErrnoError(ERRNO_CODES[e.code])
                    }
                    return stat.mode
                }, realPath: function (node) {
                    var parts = [];
                    while (node.parent !== node) {
                        parts.push(node.name);
                        node = node.parent
                    }
                    parts.push(node.mount.opts.root);
                    parts.reverse();
                    return PATH.join.apply(null, parts)
                }, flagsForNode: function (flags) {
                    flags &= ~2097152;
                    flags &= ~2048;
                    flags &= ~32768;
                    flags &= ~524288;
                    var newFlags = 0;
                    for (var k in NODEFS.flagsForNodeMap) {
                        if (flags & k) {
                            newFlags |= NODEFS.flagsForNodeMap[k];
                            flags ^= k
                        }
                    }
                    if (!flags) {
                        return newFlags
                    } else {
                        throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
                    }
                }, node_ops: {
                    getattr: function (node) {
                        var path = NODEFS.realPath(node);
                        var stat;
                        try {
                            stat = fs.lstatSync(path)
                        } catch (e) {
                            if (!e.code) throw e;
                            throw new FS.ErrnoError(ERRNO_CODES[e.code])
                        }
                        if (NODEFS.isWindows && !stat.blksize) {
                            stat.blksize = 4096
                        }
                        if (NODEFS.isWindows && !stat.blocks) {
                            stat.blocks = (stat.size + stat.blksize - 1) / stat.blksize | 0
                        }
                        return {
                            dev: stat.dev,
                            ino: stat.ino,
                            mode: stat.mode,
                            nlink: stat.nlink,
                            uid: stat.uid,
                            gid: stat.gid,
                            rdev: stat.rdev,
                            size: stat.size,
                            atime: stat.atime,
                            mtime: stat.mtime,
                            ctime: stat.ctime,
                            blksize: stat.blksize,
                            blocks: stat.blocks
                        }
                    }, setattr: function (node, attr) {
                        var path = NODEFS.realPath(node);
                        try {
                            if (attr.mode !== undefined) {
                                fs.chmodSync(path, attr.mode);
                                node.mode = attr.mode
                            }
                            if (attr.timestamp !== undefined) {
                                var date = new Date(attr.timestamp);
                                fs.utimesSync(path, date, date)
                            }
                            if (attr.size !== undefined) {
                                fs.truncateSync(path, attr.size)
                            }
                        } catch (e) {
                            if (!e.code) throw e;
                            throw new FS.ErrnoError(ERRNO_CODES[e.code])
                        }
                    }, lookup: function (parent, name) {
                        var path = PATH.join2(NODEFS.realPath(parent), name);
                        var mode = NODEFS.getMode(path);
                        return NODEFS.createNode(parent, name, mode)
                    }, mknod: function (parent, name, mode, dev) {
                        var node = NODEFS.createNode(parent, name, mode, dev);
                        var path = NODEFS.realPath(node);
                        try {
                            if (FS.isDir(node.mode)) {
                                fs.mkdirSync(path, node.mode)
                            } else {
                                fs.writeFileSync(path, "", {mode: node.mode})
                            }
                        } catch (e) {
                            if (!e.code) throw e;
                            throw new FS.ErrnoError(ERRNO_CODES[e.code])
                        }
                        return node
                    }, rename: function (oldNode, newDir, newName) {
                        var oldPath = NODEFS.realPath(oldNode);
                        var newPath = PATH.join2(NODEFS.realPath(newDir), newName);
                        try {
                            fs.renameSync(oldPath, newPath)
                        } catch (e) {
                            if (!e.code) throw e;
                            throw new FS.ErrnoError(ERRNO_CODES[e.code])
                        }
                    }, unlink: function (parent, name) {
                        var path = PATH.join2(NODEFS.realPath(parent), name);
                        try {
                            fs.unlinkSync(path)
                        } catch (e) {
                            if (!e.code) throw e;
                            throw new FS.ErrnoError(ERRNO_CODES[e.code])
                        }
                    }, rmdir: function (parent, name) {
                        var path = PATH.join2(NODEFS.realPath(parent), name);
                        try {
                            fs.rmdirSync(path)
                        } catch (e) {
                            if (!e.code) throw e;
                            throw new FS.ErrnoError(ERRNO_CODES[e.code])
                        }
                    }, readdir: function (node) {
                        var path = NODEFS.realPath(node);
                        try {
                            return fs.readdirSync(path)
                        } catch (e) {
                            if (!e.code) throw e;
                            throw new FS.ErrnoError(ERRNO_CODES[e.code])
                        }
                    }, symlink: function (parent, newName, oldPath) {
                        var newPath = PATH.join2(NODEFS.realPath(parent), newName);
                        try {
                            fs.symlinkSync(oldPath, newPath)
                        } catch (e) {
                            if (!e.code) throw e;
                            throw new FS.ErrnoError(ERRNO_CODES[e.code])
                        }
                    }, readlink: function (node) {
                        var path = NODEFS.realPath(node);
                        try {
                            path = fs.readlinkSync(path);
                            path = NODEJS_PATH.relative(NODEJS_PATH.resolve(node.mount.opts.root), path);
                            return path
                        } catch (e) {
                            if (!e.code) throw e;
                            throw new FS.ErrnoError(ERRNO_CODES[e.code])
                        }
                    }
                }, stream_ops: {
                    open: function (stream) {
                        var path = NODEFS.realPath(stream.node);
                        try {
                            if (FS.isFile(stream.node.mode)) {
                                stream.nfd = fs.openSync(path, NODEFS.flagsForNode(stream.flags))
                            }
                        } catch (e) {
                            if (!e.code) throw e;
                            throw new FS.ErrnoError(ERRNO_CODES[e.code])
                        }
                    }, close: function (stream) {
                        try {
                            if (FS.isFile(stream.node.mode) && stream.nfd) {
                                fs.closeSync(stream.nfd)
                            }
                        } catch (e) {
                            if (!e.code) throw e;
                            throw new FS.ErrnoError(ERRNO_CODES[e.code])
                        }
                    }, read: function (stream, buffer, offset, length, position) {
                        if (length === 0) return 0;
                        try {
                            return fs.readSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position)
                        } catch (e) {
                            throw new FS.ErrnoError(ERRNO_CODES[e.code])
                        }
                    }, write: function (stream, buffer, offset, length, position) {
                        try {
                            return fs.writeSync(stream.nfd, NODEFS.bufferFrom(buffer.buffer), offset, length, position)
                        } catch (e) {
                            throw new FS.ErrnoError(ERRNO_CODES[e.code])
                        }
                    }, llseek: function (stream, offset, whence) {
                        var position = offset;
                        if (whence === 1) {
                            position += stream.position
                        } else if (whence === 2) {
                            if (FS.isFile(stream.node.mode)) {
                                try {
                                    var stat = fs.fstatSync(stream.nfd);
                                    position += stat.size
                                } catch (e) {
                                    throw new FS.ErrnoError(ERRNO_CODES[e.code])
                                }
                            }
                        }
                        if (position < 0) {
                            throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
                        }
                        return position
                    }
                }
            };
            var WORKERFS = {
                DIR_MODE: 16895, FILE_MODE: 33279, reader: null, mount: function (mount) {
                    assert(ENVIRONMENT_IS_WORKER);
                    if (!WORKERFS.reader) WORKERFS.reader = new FileReaderSync;
                    var root = WORKERFS.createNode(null, "/", WORKERFS.DIR_MODE, 0);
                    var createdParents = {};

                    function ensureParent(path) {
                        var parts = path.split("/");
                        var parent = root;
                        for (var i = 0; i < parts.length - 1; i++) {
                            var curr = parts.slice(0, i + 1).join("/");
                            if (!createdParents[curr]) {
                                createdParents[curr] = WORKERFS.createNode(parent, parts[i], WORKERFS.DIR_MODE, 0)
                            }
                            parent = createdParents[curr]
                        }
                        return parent
                    }

                    function base(path) {
                        var parts = path.split("/");
                        return parts[parts.length - 1]
                    }

                    Array.prototype.forEach.call(mount.opts["files"] || [], function (file) {
                        WORKERFS.createNode(ensureParent(file.name), base(file.name), WORKERFS.FILE_MODE, 0, file, file.lastModifiedDate)
                    });
                    (mount.opts["blobs"] || []).forEach(function (obj) {
                        WORKERFS.createNode(ensureParent(obj["name"]), base(obj["name"]), WORKERFS.FILE_MODE, 0, obj["data"])
                    });
                    (mount.opts["packages"] || []).forEach(function (pack) {
                        pack["metadata"].files.forEach(function (file) {
                            var name = file.filename.substr(1);
                            WORKERFS.createNode(ensureParent(name), base(name), WORKERFS.FILE_MODE, 0, pack["blob"].slice(file.start, file.end))
                        })
                    });
                    return root
                }, createNode: function (parent, name, mode, dev, contents, mtime) {
                    var node = FS.createNode(parent, name, mode);
                    node.mode = mode;
                    node.node_ops = WORKERFS.node_ops;
                    node.stream_ops = WORKERFS.stream_ops;
                    node.timestamp = (mtime || new Date).getTime();
                    assert(WORKERFS.FILE_MODE !== WORKERFS.DIR_MODE);
                    if (mode === WORKERFS.FILE_MODE) {
                        node.size = contents.size;
                        node.contents = contents
                    } else {
                        node.size = 4096;
                        node.contents = {}
                    }
                    if (parent) {
                        parent.contents[name] = node
                    }
                    return node
                }, node_ops: {
                    getattr: function (node) {
                        return {
                            dev: 1,
                            ino: undefined,
                            mode: node.mode,
                            nlink: 1,
                            uid: 0,
                            gid: 0,
                            rdev: undefined,
                            size: node.size,
                            atime: new Date(node.timestamp),
                            mtime: new Date(node.timestamp),
                            ctime: new Date(node.timestamp),
                            blksize: 4096,
                            blocks: Math.ceil(node.size / 4096)
                        }
                    }, setattr: function (node, attr) {
                        if (attr.mode !== undefined) {
                            node.mode = attr.mode
                        }
                        if (attr.timestamp !== undefined) {
                            node.timestamp = attr.timestamp
                        }
                    }, lookup: function (parent, name) {
                        throw new FS.ErrnoError(ERRNO_CODES.ENOENT)
                    }, mknod: function (parent, name, mode, dev) {
                        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
                    }, rename: function (oldNode, newDir, newName) {
                        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
                    }, unlink: function (parent, name) {
                        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
                    }, rmdir: function (parent, name) {
                        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
                    }, readdir: function (node) {
                        var entries = [".", ".."];
                        for (var key in node.contents) {
                            if (!node.contents.hasOwnProperty(key)) {
                                continue
                            }
                            entries.push(key)
                        }
                        return entries
                    }, symlink: function (parent, newName, oldPath) {
                        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
                    }, readlink: function (node) {
                        throw new FS.ErrnoError(ERRNO_CODES.EPERM)
                    }
                }, stream_ops: {
                    read: function (stream, buffer, offset, length, position) {
                        if (position >= stream.node.size) return 0;
                        var chunk = stream.node.contents.slice(position, position + length);
                        var ab = WORKERFS.reader.readAsArrayBuffer(chunk);
                        buffer.set(new Uint8Array(ab), offset);
                        return chunk.size
                    }, write: function (stream, buffer, offset, length, position) {
                        throw new FS.ErrnoError(ERRNO_CODES.EIO)
                    }, llseek: function (stream, offset, whence) {
                        var position = offset;
                        if (whence === 1) {
                            position += stream.position
                        } else if (whence === 2) {
                            if (FS.isFile(stream.node.mode)) {
                                position += stream.node.size
                            }
                        }
                        if (position < 0) {
                            throw new FS.ErrnoError(ERRNO_CODES.EINVAL)
                        }
                        return position
                    }
                }
            };
            var FS = {
                root: null,
                mounts: [],
                devices: {},
                streams: [],
                nextInode: 1,
                nameTable: null,
                currentPath: "/",
                initialized: false,
                ignorePermissions: true,
                trackingDelegate: {},
                tracking: {openFlags: {READ: 1, WRITE: 2}},
                ErrnoError: null,
                genericErrors: {},
                filesystems: null,
                syncFSRequests: 0,
                handleFSError: function (e) {
                    if (!(e instanceof FS.ErrnoError)) throw e + " : " + stackTrace();
                    return ___setErrNo(e.errno)
                },
                lookupPath: function (path, opts) {
                    path = PATH.resolve(FS.cwd(), path);
                    opts = opts || {};
                    if (!path) return {path: "", node: null};
                    var defaults = {follow_mount: true, recurse_count: 0};
                    for (var key in defaults) {
                        if (opts[key] === undefined) {
                            opts[key] = defaults[key]
                        }
                    }
                    if (opts.recurse_count > 8) {
                        throw new FS.ErrnoError(40)
                    }
                    var parts = PATH.normalizeArray(path.split("/").filter(function (p) {
                        return !!p
                    }), false);
                    var current = FS.root;
                    var current_path = "/";
                    for (var i = 0; i < parts.length; i++) {
                        var islast = i === parts.length - 1;
                        if (islast && opts.parent) {
                            break
                        }
                        current = FS.lookupNode(current, parts[i]);
                        current_path = PATH.join2(current_path, parts[i]);
                        if (FS.isMountpoint(current)) {
                            if (!islast || islast && opts.follow_mount) {
                                current = current.mounted.root
                            }
                        }
                        if (!islast || opts.follow) {
                            var count = 0;
                            while (FS.isLink(current.mode)) {
                                var link = FS.readlink(current_path);
                                current_path = PATH.resolve(PATH.dirname(current_path), link);
                                var lookup = FS.lookupPath(current_path, {recurse_count: opts.recurse_count});
                                current = lookup.node;
                                if (count++ > 40) {
                                    throw new FS.ErrnoError(40)
                                }
                            }
                        }
                    }
                    return {path: current_path, node: current}
                },
                getPath: function (node) {
                    var path;
                    while (true) {
                        if (FS.isRoot(node)) {
                            var mount = node.mount.mountpoint;
                            if (!path) return mount;
                            return mount[mount.length - 1] !== "/" ? mount + "/" + path : mount + path
                        }
                        path = path ? node.name + "/" + path : node.name;
                        node = node.parent
                    }
                },
                hashName: function (parentid, name) {
                    var hash = 0;
                    for (var i = 0; i < name.length; i++) {
                        hash = (hash << 5) - hash + name.charCodeAt(i) | 0
                    }
                    return (parentid + hash >>> 0) % FS.nameTable.length
                },
                hashAddNode: function (node) {
                    var hash = FS.hashName(node.parent.id, node.name);
                    node.name_next = FS.nameTable[hash];
                    FS.nameTable[hash] = node
                },
                hashRemoveNode: function (node) {
                    var hash = FS.hashName(node.parent.id, node.name);
                    if (FS.nameTable[hash] === node) {
                        FS.nameTable[hash] = node.name_next
                    } else {
                        var current = FS.nameTable[hash];
                        while (current) {
                            if (current.name_next === node) {
                                current.name_next = node.name_next;
                                break
                            }
                            current = current.name_next
                        }
                    }
                },
                lookupNode: function (parent, name) {
                    var err = FS.mayLookup(parent);
                    if (err) {
                        throw new FS.ErrnoError(err, parent)
                    }
                    var hash = FS.hashName(parent.id, name);
                    for (var node = FS.nameTable[hash]; node; node = node.name_next) {
                        var nodeName = node.name;
                        if (node.parent.id === parent.id && nodeName === name) {
                            return node
                        }
                    }
                    return FS.lookup(parent, name)
                },
                createNode: function (parent, name, mode, rdev) {
                    if (!FS.FSNode) {
                        FS.FSNode = function (parent, name, mode, rdev) {
                            if (!parent) {
                                parent = this
                            }
                            this.parent = parent;
                            this.mount = parent.mount;
                            this.mounted = null;
                            this.id = FS.nextInode++;
                            this.name = name;
                            this.mode = mode;
                            this.node_ops = {};
                            this.stream_ops = {};
                            this.rdev = rdev
                        };
                        FS.FSNode.prototype = {};
                        var readMode = 292 | 73;
                        var writeMode = 146;
                        Object.defineProperties(FS.FSNode.prototype, {
                            read: {
                                get: function () {
                                    return (this.mode & readMode) === readMode
                                }, set: function (val) {
                                    val ? this.mode |= readMode : this.mode &= ~readMode
                                }
                            }, write: {
                                get: function () {
                                    return (this.mode & writeMode) === writeMode
                                }, set: function (val) {
                                    val ? this.mode |= writeMode : this.mode &= ~writeMode
                                }
                            }, isFolder: {
                                get: function () {
                                    return FS.isDir(this.mode)
                                }
                            }, isDevice: {
                                get: function () {
                                    return FS.isChrdev(this.mode)
                                }
                            }
                        })
                    }
                    var node = new FS.FSNode(parent, name, mode, rdev);
                    FS.hashAddNode(node);
                    return node
                },
                destroyNode: function (node) {
                    FS.hashRemoveNode(node)
                },
                isRoot: function (node) {
                    return node === node.parent
                },
                isMountpoint: function (node) {
                    return !!node.mounted
                },
                isFile: function (mode) {
                    return (mode & 61440) === 32768
                },
                isDir: function (mode) {
                    return (mode & 61440) === 16384
                },
                isLink: function (mode) {
                    return (mode & 61440) === 40960
                },
                isChrdev: function (mode) {
                    return (mode & 61440) === 8192
                },
                isBlkdev: function (mode) {
                    return (mode & 61440) === 24576
                },
                isFIFO: function (mode) {
                    return (mode & 61440) === 4096
                },
                isSocket: function (mode) {
                    return (mode & 49152) === 49152
                },
                flagModes: {
                    "r": 0,
                    "rs": 1052672,
                    "r+": 2,
                    "w": 577,
                    "wx": 705,
                    "xw": 705,
                    "w+": 578,
                    "wx+": 706,
                    "xw+": 706,
                    "a": 1089,
                    "ax": 1217,
                    "xa": 1217,
                    "a+": 1090,
                    "ax+": 1218,
                    "xa+": 1218
                },
                modeStringToFlags: function (str) {
                    var flags = FS.flagModes[str];
                    if (typeof flags === "undefined") {
                        throw new Error("Unknown file open mode: " + str)
                    }
                    return flags
                },
                flagsToPermissionString: function (flag) {
                    var perms = ["r", "w", "rw"][flag & 3];
                    if (flag & 512) {
                        perms += "w"
                    }
                    return perms
                },
                nodePermissions: function (node, perms) {
                    if (FS.ignorePermissions) {
                        return 0
                    }
                    if (perms.indexOf("r") !== -1 && !(node.mode & 292)) {
                        return 13
                    } else if (perms.indexOf("w") !== -1 && !(node.mode & 146)) {
                        return 13
                    } else if (perms.indexOf("x") !== -1 && !(node.mode & 73)) {
                        return 13
                    }
                    return 0
                },
                mayLookup: function (dir) {
                    var err = FS.nodePermissions(dir, "x");
                    if (err) return err;
                    if (!dir.node_ops.lookup) return 13;
                    return 0
                },
                mayCreate: function (dir, name) {
                    try {
                        var node = FS.lookupNode(dir, name);
                        return 17
                    } catch (e) {
                    }
                    return FS.nodePermissions(dir, "wx")
                },
                mayDelete: function (dir, name, isdir) {
                    var node;
                    try {
                        node = FS.lookupNode(dir, name)
                    } catch (e) {
                        return e.errno
                    }
                    var err = FS.nodePermissions(dir, "wx");
                    if (err) {
                        return err
                    }
                    if (isdir) {
                        if (!FS.isDir(node.mode)) {
                            return 20
                        }
                        if (FS.isRoot(node) || FS.getPath(node) === FS.cwd()) {
                            return 16
                        }
                    } else {
                        if (FS.isDir(node.mode)) {
                            return 21
                        }
                    }
                    return 0
                },
                mayOpen: function (node, flags) {
                    if (!node) {
                        return 2
                    }
                    if (FS.isLink(node.mode)) {
                        return 40
                    } else if (FS.isDir(node.mode)) {
                        if (FS.flagsToPermissionString(flags) !== "r" || flags & 512) {
                            return 21
                        }
                    }
                    return FS.nodePermissions(node, FS.flagsToPermissionString(flags))
                },
                MAX_OPEN_FDS: 4096,
                nextfd: function (fd_start, fd_end) {
                    fd_start = fd_start || 0;
                    fd_end = fd_end || FS.MAX_OPEN_FDS;
                    for (var fd = fd_start; fd <= fd_end; fd++) {
                        if (!FS.streams[fd]) {
                            return fd
                        }
                    }
                    throw new FS.ErrnoError(24)
                },
                getStream: function (fd) {
                    return FS.streams[fd]
                },
                createStream: function (stream, fd_start, fd_end) {
                    if (!FS.FSStream) {
                        FS.FSStream = function () {
                        };
                        FS.FSStream.prototype = {};
                        Object.defineProperties(FS.FSStream.prototype, {
                            object: {
                                get: function () {
                                    return this.node
                                }, set: function (val) {
                                    this.node = val
                                }
                            }, isRead: {
                                get: function () {
                                    return (this.flags & 2097155) !== 1
                                }
                            }, isWrite: {
                                get: function () {
                                    return (this.flags & 2097155) !== 0
                                }
                            }, isAppend: {
                                get: function () {
                                    return this.flags & 1024
                                }
                            }
                        })
                    }
                    var newStream = new FS.FSStream;
                    for (var p in stream) {
                        newStream[p] = stream[p]
                    }
                    stream = newStream;
                    var fd = FS.nextfd(fd_start, fd_end);
                    stream.fd = fd;
                    FS.streams[fd] = stream;
                    return stream
                },
                closeStream: function (fd) {
                    FS.streams[fd] = null
                },
                chrdev_stream_ops: {
                    open: function (stream) {
                        var device = FS.getDevice(stream.node.rdev);
                        stream.stream_ops = device.stream_ops;
                        if (stream.stream_ops.open) {
                            stream.stream_ops.open(stream)
                        }
                    }, llseek: function () {
                        throw new FS.ErrnoError(29)
                    }
                },
                major: function (dev) {
                    return dev >> 8
                },
                minor: function (dev) {
                    return dev & 255
                },
                makedev: function (ma, mi) {
                    return ma << 8 | mi
                },
                registerDevice: function (dev, ops) {
                    FS.devices[dev] = {stream_ops: ops}
                },
                getDevice: function (dev) {
                    return FS.devices[dev]
                },
                getMounts: function (mount) {
                    var mounts = [];
                    var check = [mount];
                    while (check.length) {
                        var m = check.pop();
                        mounts.push(m);
                        check.push.apply(check, m.mounts)
                    }
                    return mounts
                },
                syncfs: function (populate, callback) {
                    if (typeof populate === "function") {
                        callback = populate;
                        populate = false
                    }
                    FS.syncFSRequests++;
                    if (FS.syncFSRequests > 1) {
                        console.log("warning: " + FS.syncFSRequests + " FS.syncfs operations in flight at once, probably just doing extra work")
                    }
                    var mounts = FS.getMounts(FS.root.mount);
                    var completed = 0;

                    function doCallback(err) {
                        FS.syncFSRequests--;
                        return callback(err)
                    }

                    function done(err) {
                        if (err) {
                            if (!done.errored) {
                                done.errored = true;
                                return doCallback(err)
                            }
                            return
                        }
                        if (++completed >= mounts.length) {
                            doCallback(null)
                        }
                    }

                    mounts.forEach(function (mount) {
                        if (!mount.type.syncfs) {
                            return done(null)
                        }
                        mount.type.syncfs(mount, populate, done)
                    })
                },
                mount: function (type, opts, mountpoint) {
                    var root = mountpoint === "/";
                    var pseudo = !mountpoint;
                    var node;
                    if (root && FS.root) {
                        throw new FS.ErrnoError(16)
                    } else if (!root && !pseudo) {
                        var lookup = FS.lookupPath(mountpoint, {follow_mount: false});
                        mountpoint = lookup.path;
                        node = lookup.node;
                        if (FS.isMountpoint(node)) {
                            throw new FS.ErrnoError(16)
                        }
                        if (!FS.isDir(node.mode)) {
                            throw new FS.ErrnoError(20)
                        }
                    }
                    var mount = {type: type, opts: opts, mountpoint: mountpoint, mounts: []};
                    var mountRoot = type.mount(mount);
                    mountRoot.mount = mount;
                    mount.root = mountRoot;
                    if (root) {
                        FS.root = mountRoot
                    } else if (node) {
                        node.mounted = mount;
                        if (node.mount) {
                            node.mount.mounts.push(mount)
                        }
                    }
                    return mountRoot
                },
                unmount: function (mountpoint) {
                    var lookup = FS.lookupPath(mountpoint, {follow_mount: false});
                    if (!FS.isMountpoint(lookup.node)) {
                        throw new FS.ErrnoError(22)
                    }
                    var node = lookup.node;
                    var mount = node.mounted;
                    var mounts = FS.getMounts(mount);
                    Object.keys(FS.nameTable).forEach(function (hash) {
                        var current = FS.nameTable[hash];
                        while (current) {
                            var next = current.name_next;
                            if (mounts.indexOf(current.mount) !== -1) {
                                FS.destroyNode(current)
                            }
                            current = next
                        }
                    });
                    node.mounted = null;
                    var idx = node.mount.mounts.indexOf(mount);
                    node.mount.mounts.splice(idx, 1)
                },
                lookup: function (parent, name) {
                    return parent.node_ops.lookup(parent, name)
                },
                mknod: function (path, mode, dev) {
                    var lookup = FS.lookupPath(path, {parent: true});
                    var parent = lookup.node;
                    var name = PATH.basename(path);
                    if (!name || name === "." || name === "..") {
                        throw new FS.ErrnoError(22)
                    }
                    var err = FS.mayCreate(parent, name);
                    if (err) {
                        throw new FS.ErrnoError(err)
                    }
                    if (!parent.node_ops.mknod) {
                        throw new FS.ErrnoError(1)
                    }
                    return parent.node_ops.mknod(parent, name, mode, dev)
                },
                create: function (path, mode) {
                    mode = mode !== undefined ? mode : 438;
                    mode &= 4095;
                    mode |= 32768;
                    return FS.mknod(path, mode, 0)
                },
                mkdir: function (path, mode) {
                    mode = mode !== undefined ? mode : 511;
                    mode &= 511 | 512;
                    mode |= 16384;
                    return FS.mknod(path, mode, 0)
                },
                mkdirTree: function (path, mode) {
                    var dirs = path.split("/");
                    var d = "";
                    for (var i = 0; i < dirs.length; ++i) {
                        if (!dirs[i]) continue;
                        d += "/" + dirs[i];
                        try {
                            FS.mkdir(d, mode)
                        } catch (e) {
                            if (e.errno != 17) throw e
                        }
                    }
                },
                mkdev: function (path, mode, dev) {
                    if (typeof dev === "undefined") {
                        dev = mode;
                        mode = 438
                    }
                    mode |= 8192;
                    return FS.mknod(path, mode, dev)
                },
                symlink: function (oldpath, newpath) {
                    if (!PATH.resolve(oldpath)) {
                        throw new FS.ErrnoError(2)
                    }
                    var lookup = FS.lookupPath(newpath, {parent: true});
                    var parent = lookup.node;
                    if (!parent) {
                        throw new FS.ErrnoError(2)
                    }
                    var newname = PATH.basename(newpath);
                    var err = FS.mayCreate(parent, newname);
                    if (err) {
                        throw new FS.ErrnoError(err)
                    }
                    if (!parent.node_ops.symlink) {
                        throw new FS.ErrnoError(1)
                    }
                    return parent.node_ops.symlink(parent, newname, oldpath)
                },
                rename: function (old_path, new_path) {
                    var old_dirname = PATH.dirname(old_path);
                    var new_dirname = PATH.dirname(new_path);
                    var old_name = PATH.basename(old_path);
                    var new_name = PATH.basename(new_path);
                    var lookup, old_dir, new_dir;
                    try {
                        lookup = FS.lookupPath(old_path, {parent: true});
                        old_dir = lookup.node;
                        lookup = FS.lookupPath(new_path, {parent: true});
                        new_dir = lookup.node
                    } catch (e) {
                        throw new FS.ErrnoError(16)
                    }
                    if (!old_dir || !new_dir) throw new FS.ErrnoError(2);
                    if (old_dir.mount !== new_dir.mount) {
                        throw new FS.ErrnoError(18)
                    }
                    var old_node = FS.lookupNode(old_dir, old_name);
                    var relative = PATH.relative(old_path, new_dirname);
                    if (relative.charAt(0) !== ".") {
                        throw new FS.ErrnoError(22)
                    }
                    relative = PATH.relative(new_path, old_dirname);
                    if (relative.charAt(0) !== ".") {
                        throw new FS.ErrnoError(39)
                    }
                    var new_node;
                    try {
                        new_node = FS.lookupNode(new_dir, new_name)
                    } catch (e) {
                    }
                    if (old_node === new_node) {
                        return
                    }
                    var isdir = FS.isDir(old_node.mode);
                    var err = FS.mayDelete(old_dir, old_name, isdir);
                    if (err) {
                        throw new FS.ErrnoError(err)
                    }
                    err = new_node ? FS.mayDelete(new_dir, new_name, isdir) : FS.mayCreate(new_dir, new_name);
                    if (err) {
                        throw new FS.ErrnoError(err)
                    }
                    if (!old_dir.node_ops.rename) {
                        throw new FS.ErrnoError(1)
                    }
                    if (FS.isMountpoint(old_node) || new_node && FS.isMountpoint(new_node)) {
                        throw new FS.ErrnoError(16)
                    }
                    if (new_dir !== old_dir) {
                        err = FS.nodePermissions(old_dir, "w");
                        if (err) {
                            throw new FS.ErrnoError(err)
                        }
                    }
                    try {
                        if (FS.trackingDelegate["willMovePath"]) {
                            FS.trackingDelegate["willMovePath"](old_path, new_path)
                        }
                    } catch (e) {
                        console.log("FS.trackingDelegate['willMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message)
                    }
                    FS.hashRemoveNode(old_node);
                    try {
                        old_dir.node_ops.rename(old_node, new_dir, new_name)
                    } catch (e) {
                        throw e
                    } finally {
                        FS.hashAddNode(old_node)
                    }
                    try {
                        if (FS.trackingDelegate["onMovePath"]) FS.trackingDelegate["onMovePath"](old_path, new_path)
                    } catch (e) {
                        console.log("FS.trackingDelegate['onMovePath']('" + old_path + "', '" + new_path + "') threw an exception: " + e.message)
                    }
                },
                rmdir: function (path) {
                    var lookup = FS.lookupPath(path, {parent: true});
                    var parent = lookup.node;
                    var name = PATH.basename(path);
                    var node = FS.lookupNode(parent, name);
                    var err = FS.mayDelete(parent, name, true);
                    if (err) {
                        throw new FS.ErrnoError(err)
                    }
                    if (!parent.node_ops.rmdir) {
                        throw new FS.ErrnoError(1)
                    }
                    if (FS.isMountpoint(node)) {
                        throw new FS.ErrnoError(16)
                    }
                    try {
                        if (FS.trackingDelegate["willDeletePath"]) {
                            FS.trackingDelegate["willDeletePath"](path)
                        }
                    } catch (e) {
                        console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message)
                    }
                    parent.node_ops.rmdir(parent, name);
                    FS.destroyNode(node);
                    try {
                        if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path)
                    } catch (e) {
                        console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message)
                    }
                },
                readdir: function (path) {
                    var lookup = FS.lookupPath(path, {follow: true});
                    var node = lookup.node;
                    if (!node.node_ops.readdir) {
                        throw new FS.ErrnoError(20)
                    }
                    return node.node_ops.readdir(node)
                },
                unlink: function (path) {
                    var lookup = FS.lookupPath(path, {parent: true});
                    var parent = lookup.node;
                    var name = PATH.basename(path);
                    var node = FS.lookupNode(parent, name);
                    var err = FS.mayDelete(parent, name, false);
                    if (err) {
                        throw new FS.ErrnoError(err)
                    }
                    if (!parent.node_ops.unlink) {
                        throw new FS.ErrnoError(1)
                    }
                    if (FS.isMountpoint(node)) {
                        throw new FS.ErrnoError(16)
                    }
                    try {
                        if (FS.trackingDelegate["willDeletePath"]) {
                            FS.trackingDelegate["willDeletePath"](path)
                        }
                    } catch (e) {
                        console.log("FS.trackingDelegate['willDeletePath']('" + path + "') threw an exception: " + e.message)
                    }
                    parent.node_ops.unlink(parent, name);
                    FS.destroyNode(node);
                    try {
                        if (FS.trackingDelegate["onDeletePath"]) FS.trackingDelegate["onDeletePath"](path)
                    } catch (e) {
                        console.log("FS.trackingDelegate['onDeletePath']('" + path + "') threw an exception: " + e.message)
                    }
                },
                readlink: function (path) {
                    var lookup = FS.lookupPath(path);
                    var link = lookup.node;
                    if (!link) {
                        throw new FS.ErrnoError(2)
                    }
                    if (!link.node_ops.readlink) {
                        throw new FS.ErrnoError(22)
                    }
                    return PATH.resolve(FS.getPath(link.parent), link.node_ops.readlink(link))
                },
                stat: function (path, dontFollow) {
                    var lookup = FS.lookupPath(path, {follow: !dontFollow});
                    var node = lookup.node;
                    if (!node) {
                        throw new FS.ErrnoError(2)
                    }
                    if (!node.node_ops.getattr) {
                        throw new FS.ErrnoError(1)
                    }
                    return node.node_ops.getattr(node)
                },
                lstat: function (path) {
                    return FS.stat(path, true)
                },
                chmod: function (path, mode, dontFollow) {
                    var node;
                    if (typeof path === "string") {
                        var lookup = FS.lookupPath(path, {follow: !dontFollow});
                        node = lookup.node
                    } else {
                        node = path
                    }
                    if (!node.node_ops.setattr) {
                        throw new FS.ErrnoError(1)
                    }
                    node.node_ops.setattr(node, {mode: mode & 4095 | node.mode & ~4095, timestamp: Date.now()})
                },
                lchmod: function (path, mode) {
                    FS.chmod(path, mode, true)
                },
                fchmod: function (fd, mode) {
                    var stream = FS.getStream(fd);
                    if (!stream) {
                        throw new FS.ErrnoError(9)
                    }
                    FS.chmod(stream.node, mode)
                },
                chown: function (path, uid, gid, dontFollow) {
                    var node;
                    if (typeof path === "string") {
                        var lookup = FS.lookupPath(path, {follow: !dontFollow});
                        node = lookup.node
                    } else {
                        node = path
                    }
                    if (!node.node_ops.setattr) {
                        throw new FS.ErrnoError(1)
                    }
                    node.node_ops.setattr(node, {timestamp: Date.now()})
                },
                lchown: function (path, uid, gid) {
                    FS.chown(path, uid, gid, true)
                },
                fchown: function (fd, uid, gid) {
                    var stream = FS.getStream(fd);
                    if (!stream) {
                        throw new FS.ErrnoError(9)
                    }
                    FS.chown(stream.node, uid, gid)
                },
                truncate: function (path, len) {
                    if (len < 0) {
                        throw new FS.ErrnoError(22)
                    }
                    var node;
                    if (typeof path === "string") {
                        var lookup = FS.lookupPath(path, {follow: true});
                        node = lookup.node
                    } else {
                        node = path
                    }
                    if (!node.node_ops.setattr) {
                        throw new FS.ErrnoError(1)
                    }
                    if (FS.isDir(node.mode)) {
                        throw new FS.ErrnoError(21)
                    }
                    if (!FS.isFile(node.mode)) {
                        throw new FS.ErrnoError(22)
                    }
                    var err = FS.nodePermissions(node, "w");
                    if (err) {
                        throw new FS.ErrnoError(err)
                    }
                    node.node_ops.setattr(node, {size: len, timestamp: Date.now()})
                },
                ftruncate: function (fd, len) {
                    var stream = FS.getStream(fd);
                    if (!stream) {
                        throw new FS.ErrnoError(9)
                    }
                    if ((stream.flags & 2097155) === 0) {
                        throw new FS.ErrnoError(22)
                    }
                    FS.truncate(stream.node, len)
                },
                utime: function (path, atime, mtime) {
                    var lookup = FS.lookupPath(path, {follow: true});
                    var node = lookup.node;
                    node.node_ops.setattr(node, {timestamp: Math.max(atime, mtime)})
                },
                open: function (path, flags, mode, fd_start, fd_end) {
                    if (path === "") {
                        throw new FS.ErrnoError(2)
                    }
                    flags = typeof flags === "string" ? FS.modeStringToFlags(flags) : flags;
                    mode = typeof mode === "undefined" ? 438 : mode;
                    if (flags & 64) {
                        mode = mode & 4095 | 32768
                    } else {
                        mode = 0
                    }
                    var node;
                    if (typeof path === "object") {
                        node = path
                    } else {
                        path = PATH.normalize(path);
                        try {
                            var lookup = FS.lookupPath(path, {follow: !(flags & 131072)});
                            node = lookup.node
                        } catch (e) {
                        }
                    }
                    var created = false;
                    if (flags & 64) {
                        if (node) {
                            if (flags & 128) {
                                throw new FS.ErrnoError(17)
                            }
                        } else {
                            node = FS.mknod(path, mode, 0);
                            created = true
                        }
                    }
                    if (!node) {
                        throw new FS.ErrnoError(2)
                    }
                    if (FS.isChrdev(node.mode)) {
                        flags &= ~512
                    }
                    if (flags & 65536 && !FS.isDir(node.mode)) {
                        throw new FS.ErrnoError(20)
                    }
                    if (!created) {
                        var err = FS.mayOpen(node, flags);
                        if (err) {
                            throw new FS.ErrnoError(err)
                        }
                    }
                    if (flags & 512) {
                        FS.truncate(node, 0)
                    }
                    flags &= ~(128 | 512);
                    var stream = FS.createStream({
                        node: node,
                        path: FS.getPath(node),
                        flags: flags,
                        seekable: true,
                        position: 0,
                        stream_ops: node.stream_ops,
                        ungotten: [],
                        error: false
                    }, fd_start, fd_end);
                    if (stream.stream_ops.open) {
                        stream.stream_ops.open(stream)
                    }
                    if (Module["logReadFiles"] && !(flags & 1)) {
                        if (!FS.readFiles) FS.readFiles = {};
                        if (!(path in FS.readFiles)) {
                            FS.readFiles[path] = 1;
                            console.log("FS.trackingDelegate error on read file: " + path)
                        }
                    }
                    try {
                        if (FS.trackingDelegate["onOpenFile"]) {
                            var trackingFlags = 0;
                            if ((flags & 2097155) !== 1) {
                                trackingFlags |= FS.tracking.openFlags.READ
                            }
                            if ((flags & 2097155) !== 0) {
                                trackingFlags |= FS.tracking.openFlags.WRITE
                            }
                            FS.trackingDelegate["onOpenFile"](path, trackingFlags)
                        }
                    } catch (e) {
                        console.log("FS.trackingDelegate['onOpenFile']('" + path + "', flags) threw an exception: " + e.message)
                    }
                    return stream
                },
                close: function (stream) {
                    if (FS.isClosed(stream)) {
                        throw new FS.ErrnoError(9)
                    }
                    if (stream.getdents) stream.getdents = null;
                    try {
                        if (stream.stream_ops.close) {
                            stream.stream_ops.close(stream)
                        }
                    } catch (e) {
                        throw e
                    } finally {
                        FS.closeStream(stream.fd)
                    }
                    stream.fd = null
                },
                isClosed: function (stream) {
                    return stream.fd === null
                },
                llseek: function (stream, offset, whence) {
                    if (FS.isClosed(stream)) {
                        throw new FS.ErrnoError(9)
                    }
                    if (!stream.seekable || !stream.stream_ops.llseek) {
                        throw new FS.ErrnoError(29)
                    }
                    if (whence != 0 && whence != 1 && whence != 2) {
                        throw new FS.ErrnoError(22)
                    }
                    stream.position = stream.stream_ops.llseek(stream, offset, whence);
                    stream.ungotten = [];
                    return stream.position
                },
                read: function (stream, buffer, offset, length, position) {
                    if (length < 0 || position < 0) {
                        throw new FS.ErrnoError(22)
                    }
                    if (FS.isClosed(stream)) {
                        throw new FS.ErrnoError(9)
                    }
                    if ((stream.flags & 2097155) === 1) {
                        throw new FS.ErrnoError(9)
                    }
                    if (FS.isDir(stream.node.mode)) {
                        throw new FS.ErrnoError(21)
                    }
                    if (!stream.stream_ops.read) {
                        throw new FS.ErrnoError(22)
                    }
                    var seeking = typeof position !== "undefined";
                    if (!seeking) {
                        position = stream.position
                    } else if (!stream.seekable) {
                        throw new FS.ErrnoError(29)
                    }
                    var bytesRead = stream.stream_ops.read(stream, buffer, offset, length, position);
                    if (!seeking) stream.position += bytesRead;
                    return bytesRead
                },
                write: function (stream, buffer, offset, length, position, canOwn) {
                    if (length < 0 || position < 0) {
                        throw new FS.ErrnoError(22)
                    }
                    if (FS.isClosed(stream)) {
                        throw new FS.ErrnoError(9)
                    }
                    if ((stream.flags & 2097155) === 0) {
                        throw new FS.ErrnoError(9)
                    }
                    if (FS.isDir(stream.node.mode)) {
                        throw new FS.ErrnoError(21)
                    }
                    if (!stream.stream_ops.write) {
                        throw new FS.ErrnoError(22)
                    }
                    if (stream.flags & 1024) {
                        FS.llseek(stream, 0, 2)
                    }
                    var seeking = typeof position !== "undefined";
                    if (!seeking) {
                        position = stream.position
                    } else if (!stream.seekable) {
                        throw new FS.ErrnoError(29)
                    }
                    var bytesWritten = stream.stream_ops.write(stream, buffer, offset, length, position, canOwn);
                    if (!seeking) stream.position += bytesWritten;
                    try {
                        if (stream.path && FS.trackingDelegate["onWriteToFile"]) FS.trackingDelegate["onWriteToFile"](stream.path)
                    } catch (e) {
                        console.log("FS.trackingDelegate['onWriteToFile']('" + stream.path + "') threw an exception: " + e.message)
                    }
                    return bytesWritten
                },
                allocate: function (stream, offset, length) {
                    if (FS.isClosed(stream)) {
                        throw new FS.ErrnoError(9)
                    }
                    if (offset < 0 || length <= 0) {
                        throw new FS.ErrnoError(22)
                    }
                    if ((stream.flags & 2097155) === 0) {
                        throw new FS.ErrnoError(9)
                    }
                    if (!FS.isFile(stream.node.mode) && !FS.isDir(stream.node.mode)) {
                        throw new FS.ErrnoError(19)
                    }
                    if (!stream.stream_ops.allocate) {
                        throw new FS.ErrnoError(95)
                    }
                    stream.stream_ops.allocate(stream, offset, length)
                },
                mmap: function (stream, buffer, offset, length, position, prot, flags) {
                    if ((stream.flags & 2097155) === 1) {
                        throw new FS.ErrnoError(13)
                    }
                    if (!stream.stream_ops.mmap) {
                        throw new FS.ErrnoError(19)
                    }
                    return stream.stream_ops.mmap(stream, buffer, offset, length, position, prot, flags)
                },
                msync: function (stream, buffer, offset, length, mmapFlags) {
                    if (!stream || !stream.stream_ops.msync) {
                        return 0
                    }
                    return stream.stream_ops.msync(stream, buffer, offset, length, mmapFlags)
                },
                munmap: function (stream) {
                    return 0
                },
                ioctl: function (stream, cmd, arg) {
                    if (!stream.stream_ops.ioctl) {
                        throw new FS.ErrnoError(25)
                    }
                    return stream.stream_ops.ioctl(stream, cmd, arg)
                },
                readFile: function (path, opts) {
                    opts = opts || {};
                    opts.flags = opts.flags || "r";
                    opts.encoding = opts.encoding || "binary";
                    if (opts.encoding !== "utf8" && opts.encoding !== "binary") {
                        throw new Error('Invalid encoding type "' + opts.encoding + '"')
                    }
                    var ret;
                    var stream = FS.open(path, opts.flags);
                    var stat = FS.stat(path);
                    var length = stat.size;
                    var buf = new Uint8Array(length);
                    FS.read(stream, buf, 0, length, 0);
                    if (opts.encoding === "utf8") {
                        ret = UTF8ArrayToString(buf, 0)
                    } else if (opts.encoding === "binary") {
                        ret = buf
                    }
                    FS.close(stream);
                    return ret
                },
                writeFile: function (path, data, opts) {
                    opts = opts || {};
                    opts.flags = opts.flags || "w";
                    var stream = FS.open(path, opts.flags, opts.mode);
                    if (typeof data === "string") {
                        var buf = new Uint8Array(lengthBytesUTF8(data) + 1);
                        var actualNumBytes = stringToUTF8Array(data, buf, 0, buf.length);
                        FS.write(stream, buf, 0, actualNumBytes, undefined, opts.canOwn)
                    } else if (ArrayBuffer.isView(data)) {
                        FS.write(stream, data, 0, data.byteLength, undefined, opts.canOwn)
                    } else {
                        throw new Error("Unsupported data type")
                    }
                    FS.close(stream)
                },
                cwd: function () {
                    return FS.currentPath
                },
                chdir: function (path) {
                    var lookup = FS.lookupPath(path, {follow: true});
                    if (lookup.node === null) {
                        throw new FS.ErrnoError(2)
                    }
                    if (!FS.isDir(lookup.node.mode)) {
                        throw new FS.ErrnoError(20)
                    }
                    var err = FS.nodePermissions(lookup.node, "x");
                    if (err) {
                        throw new FS.ErrnoError(err)
                    }
                    FS.currentPath = lookup.path
                },
                createDefaultDirectories: function () {
                    FS.mkdir("/tmp");
                    FS.mkdir("/home");
                    FS.mkdir("/home/web_user")
                },
                createDefaultDevices: function () {
                    FS.mkdir("/dev");
                    FS.registerDevice(FS.makedev(1, 3), {
                        read: function () {
                            return 0
                        }, write: function (stream, buffer, offset, length, pos) {
                            return length
                        }
                    });
                    FS.mkdev("/dev/null", FS.makedev(1, 3));
                    TTY.register(FS.makedev(5, 0), TTY.default_tty_ops);
                    TTY.register(FS.makedev(6, 0), TTY.default_tty1_ops);
                    FS.mkdev("/dev/tty", FS.makedev(5, 0));
                    FS.mkdev("/dev/tty1", FS.makedev(6, 0));
                    var random_device;
                    if (typeof crypto === "object" && typeof crypto["getRandomValues"] === "function") {
                        var randomBuffer = new Uint8Array(1);
                        random_device = function () {
                            crypto.getRandomValues(randomBuffer);
                            return randomBuffer[0]
                        }
                    } else if (ENVIRONMENT_IS_NODE) {
                        try {
                            var crypto_module = require("crypto");
                            random_device = function () {
                                return crypto_module["randomBytes"](1)[0]
                            }
                        } catch (e) {
                        }
                    } else {
                    }
                    if (!random_device) {
                        random_device = function () {
                            abort("random_device")
                        }
                    }
                    FS.createDevice("/dev", "random", random_device);
                    FS.createDevice("/dev", "urandom", random_device);
                    FS.mkdir("/dev/shm");
                    FS.mkdir("/dev/shm/tmp")
                },
                createSpecialDirectories: function () {
                    FS.mkdir("/proc");
                    FS.mkdir("/proc/self");
                    FS.mkdir("/proc/self/fd");
                    FS.mount({
                        mount: function () {
                            var node = FS.createNode("/proc/self", "fd", 16384 | 511, 73);
                            node.node_ops = {
                                lookup: function (parent, name) {
                                    var fd = +name;
                                    var stream = FS.getStream(fd);
                                    if (!stream) throw new FS.ErrnoError(9);
                                    var ret = {
                                        parent: null,
                                        mount: {mountpoint: "fake"},
                                        node_ops: {
                                            readlink: function () {
                                                return stream.path
                                            }
                                        }
                                    };
                                    ret.parent = ret;
                                    return ret
                                }
                            };
                            return node
                        }
                    }, {}, "/proc/self/fd")
                },
                createStandardStreams: function () {
                    if (Module["stdin"]) {
                        FS.createDevice("/dev", "stdin", Module["stdin"])
                    } else {
                        FS.symlink("/dev/tty", "/dev/stdin")
                    }
                    if (Module["stdout"]) {
                        FS.createDevice("/dev", "stdout", null, Module["stdout"])
                    } else {
                        FS.symlink("/dev/tty", "/dev/stdout")
                    }
                    if (Module["stderr"]) {
                        FS.createDevice("/dev", "stderr", null, Module["stderr"])
                    } else {
                        FS.symlink("/dev/tty1", "/dev/stderr")
                    }
                    var stdin = FS.open("/dev/stdin", "r");
                    var stdout = FS.open("/dev/stdout", "w");
                    var stderr = FS.open("/dev/stderr", "w")
                },
                ensureErrnoError: function () {
                    if (FS.ErrnoError) return;
                    FS.ErrnoError = function ErrnoError(errno, node) {
                        this.node = node;
                        this.setErrno = function (errno) {
                            this.errno = errno
                        };
                        this.setErrno(errno);
                        this.message = "FS error";
                        if (this.stack) Object.defineProperty(this, "stack", {value: (new Error).stack, writable: true})
                    };
                    FS.ErrnoError.prototype = new Error;
                    FS.ErrnoError.prototype.constructor = FS.ErrnoError;
                    [2].forEach(function (code) {
                        FS.genericErrors[code] = new FS.ErrnoError(code);
                        FS.genericErrors[code].stack = "<generic error, no stack>"
                    })
                },
                staticInit: function () {
                    FS.ensureErrnoError();
                    FS.nameTable = new Array(4096);
                    FS.mount(MEMFS, {}, "/");
                    FS.createDefaultDirectories();
                    FS.createDefaultDevices();
                    FS.createSpecialDirectories();
                    FS.filesystems = {"MEMFS": MEMFS, "IDBFS": IDBFS, "NODEFS": NODEFS, "WORKERFS": WORKERFS}
                },
                init: function (input, output, error) {
                    FS.init.initialized = true;
                    FS.ensureErrnoError();
                    Module["stdin"] = input || Module["stdin"];
                    Module["stdout"] = output || Module["stdout"];
                    Module["stderr"] = error || Module["stderr"];
                    FS.createStandardStreams()
                },
                quit: function () {
                    FS.init.initialized = false;
                    var fflush = Module["_fflush"];
                    if (fflush) fflush(0);
                    for (var i = 0; i < FS.streams.length; i++) {
                        var stream = FS.streams[i];
                        if (!stream) {
                            continue
                        }
                        FS.close(stream)
                    }
                },
                getMode: function (canRead, canWrite) {
                    var mode = 0;
                    if (canRead) mode |= 292 | 73;
                    if (canWrite) mode |= 146;
                    return mode
                },
                joinPath: function (parts, forceRelative) {
                    var path = PATH.join.apply(null, parts);
                    if (forceRelative && path[0] == "/") path = path.substr(1);
                    return path
                },
                absolutePath: function (relative, base) {
                    return PATH.resolve(base, relative)
                },
                standardizePath: function (path) {
                    return PATH.normalize(path)
                },
                findObject: function (path, dontResolveLastLink) {
                    var ret = FS.analyzePath(path, dontResolveLastLink);
                    if (ret.exists) {
                        return ret.object
                    } else {
                        ___setErrNo(ret.error);
                        return null
                    }
                },
                analyzePath: function (path, dontResolveLastLink) {
                    try {
                        var lookup = FS.lookupPath(path, {follow: !dontResolveLastLink});
                        path = lookup.path
                    } catch (e) {
                    }
                    var ret = {
                        isRoot: false,
                        exists: false,
                        error: 0,
                        name: null,
                        path: null,
                        object: null,
                        parentExists: false,
                        parentPath: null,
                        parentObject: null
                    };
                    try {
                        var lookup = FS.lookupPath(path, {parent: true});
                        ret.parentExists = true;
                        ret.parentPath = lookup.path;
                        ret.parentObject = lookup.node;
                        ret.name = PATH.basename(path);
                        lookup = FS.lookupPath(path, {follow: !dontResolveLastLink});
                        ret.exists = true;
                        ret.path = lookup.path;
                        ret.object = lookup.node;
                        ret.name = lookup.node.name;
                        ret.isRoot = lookup.path === "/"
                    } catch (e) {
                        ret.error = e.errno
                    }
                    return ret
                },
                createFolder: function (parent, name, canRead, canWrite) {
                    var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
                    var mode = FS.getMode(canRead, canWrite);
                    return FS.mkdir(path, mode)
                },
                createPath: function (parent, path, canRead, canWrite) {
                    parent = typeof parent === "string" ? parent : FS.getPath(parent);
                    var parts = path.split("/").reverse();
                    while (parts.length) {
                        var part = parts.pop();
                        if (!part) continue;
                        var current = PATH.join2(parent, part);
                        try {
                            FS.mkdir(current)
                        } catch (e) {
                        }
                        parent = current
                    }
                    return current
                },
                createFile: function (parent, name, properties, canRead, canWrite) {
                    var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
                    var mode = FS.getMode(canRead, canWrite);
                    return FS.create(path, mode)
                },
                createDataFile: function (parent, name, data, canRead, canWrite, canOwn) {
                    var path = name ? PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name) : parent;
                    var mode = FS.getMode(canRead, canWrite);
                    var node = FS.create(path, mode);
                    if (data) {
                        if (typeof data === "string") {
                            var arr = new Array(data.length);
                            for (var i = 0, len = data.length; i < len; ++i) arr[i] = data.charCodeAt(i);
                            data = arr
                        }
                        FS.chmod(node, mode | 146);
                        var stream = FS.open(node, "w");
                        FS.write(stream, data, 0, data.length, 0, canOwn);
                        FS.close(stream);
                        FS.chmod(node, mode)
                    }
                    return node
                },
                createDevice: function (parent, name, input, output) {
                    var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
                    var mode = FS.getMode(!!input, !!output);
                    if (!FS.createDevice.major) FS.createDevice.major = 64;
                    var dev = FS.makedev(FS.createDevice.major++, 0);
                    FS.registerDevice(dev, {
                        open: function (stream) {
                            stream.seekable = false
                        }, close: function (stream) {
                            if (output && output.buffer && output.buffer.length) {
                                output(10)
                            }
                        }, read: function (stream, buffer, offset, length, pos) {
                            var bytesRead = 0;
                            for (var i = 0; i < length; i++) {
                                var result;
                                try {
                                    result = input()
                                } catch (e) {
                                    throw new FS.ErrnoError(5)
                                }
                                if (result === undefined && bytesRead === 0) {
                                    throw new FS.ErrnoError(11)
                                }
                                if (result === null || result === undefined) break;
                                bytesRead++;
                                buffer[offset + i] = result
                            }
                            if (bytesRead) {
                                stream.node.timestamp = Date.now()
                            }
                            return bytesRead
                        }, write: function (stream, buffer, offset, length, pos) {
                            for (var i = 0; i < length; i++) {
                                try {
                                    output(buffer[offset + i])
                                } catch (e) {
                                    throw new FS.ErrnoError(5)
                                }
                            }
                            if (length) {
                                stream.node.timestamp = Date.now()
                            }
                            return i
                        }
                    });
                    return FS.mkdev(path, mode, dev)
                },
                createLink: function (parent, name, target, canRead, canWrite) {
                    var path = PATH.join2(typeof parent === "string" ? parent : FS.getPath(parent), name);
                    return FS.symlink(target, path)
                },
                forceLoadFile: function (obj) {
                    if (obj.isDevice || obj.isFolder || obj.link || obj.contents) return true;
                    var success = true;
                    if (typeof XMLHttpRequest !== "undefined") {
                        throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.")
                    } else if (Module["read"]) {
                        try {
                            obj.contents = intArrayFromString(Module["read"](obj.url), true);
                            obj.usedBytes = obj.contents.length
                        } catch (e) {
                            success = false
                        }
                    } else {
                        throw new Error("Cannot load without read() or XMLHttpRequest.")
                    }
                    if (!success) ___setErrNo(5);
                    return success
                },
                createLazyFile: function (parent, name, url, canRead, canWrite) {
                    function LazyUint8Array() {
                        this.lengthKnown = false;
                        this.chunks = []
                    }

                    LazyUint8Array.prototype.get = function LazyUint8Array_get(idx) {
                        if (idx > this.length - 1 || idx < 0) {
                            return undefined
                        }
                        var chunkOffset = idx % this.chunkSize;
                        var chunkNum = idx / this.chunkSize | 0;
                        return this.getter(chunkNum)[chunkOffset]
                    };
                    LazyUint8Array.prototype.setDataGetter = function LazyUint8Array_setDataGetter(getter) {
                        this.getter = getter
                    };
                    LazyUint8Array.prototype.cacheLength = function LazyUint8Array_cacheLength() {
                        var xhr = new XMLHttpRequest;
                        xhr.open("HEAD", url, false);
                        xhr.send(null);
                        if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
                        var datalength = Number(xhr.getResponseHeader("Content-length"));
                        var header;
                        var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
                        var usesGzip = (header = xhr.getResponseHeader("Content-Encoding")) && header === "gzip";
                        var chunkSize = 1024 * 1024;
                        if (!hasByteServing) chunkSize = datalength;
                        var doXHR = function (from, to) {
                            if (from > to) throw new Error("invalid range (" + from + ", " + to + ") or no bytes requested!");
                            if (to > datalength - 1) throw new Error("only " + datalength + " bytes available! programmer error!");
                            var xhr = new XMLHttpRequest;
                            xhr.open("GET", url, false);
                            if (datalength !== chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);
                            if (typeof Uint8Array != "undefined") xhr.responseType = "arraybuffer";
                            if (xhr.overrideMimeType) {
                                xhr.overrideMimeType("text/plain; charset=x-user-defined")
                            }
                            xhr.send(null);
                            if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + url + ". Status: " + xhr.status);
                            if (xhr.response !== undefined) {
                                return new Uint8Array(xhr.response || [])
                            } else {
                                return intArrayFromString(xhr.responseText || "", true)
                            }
                        };
                        var lazyArray = this;
                        lazyArray.setDataGetter(function (chunkNum) {
                            var start = chunkNum * chunkSize;
                            var end = (chunkNum + 1) * chunkSize - 1;
                            end = Math.min(end, datalength - 1);
                            if (typeof lazyArray.chunks[chunkNum] === "undefined") {
                                lazyArray.chunks[chunkNum] = doXHR(start, end)
                            }
                            if (typeof lazyArray.chunks[chunkNum] === "undefined") throw new Error("doXHR failed!");
                            return lazyArray.chunks[chunkNum]
                        });
                        if (usesGzip || !datalength) {
                            chunkSize = datalength = 1;
                            datalength = this.getter(0).length;
                            chunkSize = datalength;
                            console.log("LazyFiles on gzip forces download of the whole file when length is accessed")
                        }
                        this._length = datalength;
                        this._chunkSize = chunkSize;
                        this.lengthKnown = true
                    };
                    if (typeof XMLHttpRequest !== "undefined") {
                        if (!ENVIRONMENT_IS_WORKER) throw"Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";
                        var lazyArray = new LazyUint8Array;
                        Object.defineProperties(lazyArray, {
                            length: {
                                get: function () {
                                    if (!this.lengthKnown) {
                                        this.cacheLength()
                                    }
                                    return this._length
                                }
                            }, chunkSize: {
                                get: function () {
                                    if (!this.lengthKnown) {
                                        this.cacheLength()
                                    }
                                    return this._chunkSize
                                }
                            }
                        });
                        var properties = {isDevice: false, contents: lazyArray}
                    } else {
                        var properties = {isDevice: false, url: url}
                    }
                    var node = FS.createFile(parent, name, properties, canRead, canWrite);
                    if (properties.contents) {
                        node.contents = properties.contents
                    } else if (properties.url) {
                        node.contents = null;
                        node.url = properties.url
                    }
                    Object.defineProperties(node, {
                        usedBytes: {
                            get: function () {
                                return this.contents.length
                            }
                        }
                    });
                    var stream_ops = {};
                    var keys = Object.keys(node.stream_ops);
                    keys.forEach(function (key) {
                        var fn = node.stream_ops[key];
                        stream_ops[key] = function forceLoadLazyFile() {
                            if (!FS.forceLoadFile(node)) {
                                throw new FS.ErrnoError(5)
                            }
                            return fn.apply(null, arguments)
                        }
                    });
                    stream_ops.read = function stream_ops_read(stream, buffer, offset, length, position) {
                        if (!FS.forceLoadFile(node)) {
                            throw new FS.ErrnoError(5)
                        }
                        var contents = stream.node.contents;
                        if (position >= contents.length) return 0;
                        var size = Math.min(contents.length - position, length);
                        if (contents.slice) {
                            for (var i = 0; i < size; i++) {
                                buffer[offset + i] = contents[position + i]
                            }
                        } else {
                            for (var i = 0; i < size; i++) {
                                buffer[offset + i] = contents.get(position + i)
                            }
                        }
                        return size
                    };
                    node.stream_ops = stream_ops;
                    return node
                },
                createPreloadedFile: function (parent, name, url, canRead, canWrite, onload, onerror, dontCreateFile, canOwn, preFinish) {
                    Browser.init();
                    var fullname = name ? PATH.resolve(PATH.join2(parent, name)) : parent;
                    var dep = getUniqueRunDependency("cp " + fullname);

                    function processData(byteArray) {
                        function finish(byteArray) {
                            if (preFinish) preFinish();
                            if (!dontCreateFile) {
                                FS.createDataFile(parent, name, byteArray, canRead, canWrite, canOwn)
                            }
                            if (onload) onload();
                            removeRunDependency(dep)
                        }

                        var handled = false;
                        Module["preloadPlugins"].forEach(function (plugin) {
                            if (handled) return;
                            if (plugin["canHandle"](fullname)) {
                                plugin["handle"](byteArray, fullname, finish, function () {
                                    if (onerror) onerror();
                                    removeRunDependency(dep)
                                });
                                handled = true
                            }
                        });
                        if (!handled) finish(byteArray)
                    }

                    addRunDependency(dep);
                    if (typeof url == "string") {
                        Browser.asyncLoad(url, function (byteArray) {
                            processData(byteArray)
                        }, onerror)
                    } else {
                        processData(url)
                    }
                },
                indexedDB: function () {
                    return window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB
                },
                DB_NAME: function () {
                    return "EM_FS_" + window.location.pathname
                },
                DB_VERSION: 20,
                DB_STORE_NAME: "FILE_DATA",
                saveFilesToDB: function (paths, onload, onerror) {
                    onload = onload || function () {
                    };
                    onerror = onerror || function () {
                    };
                    var indexedDB = FS.indexedDB();
                    try {
                        var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
                    } catch (e) {
                        return onerror(e)
                    }
                    openRequest.onupgradeneeded = function openRequest_onupgradeneeded() {
                        console.log("creating db");
                        var db = openRequest.result;
                        db.createObjectStore(FS.DB_STORE_NAME)
                    };
                    openRequest.onsuccess = function openRequest_onsuccess() {
                        var db = openRequest.result;
                        var transaction = db.transaction([FS.DB_STORE_NAME], "readwrite");
                        var files = transaction.objectStore(FS.DB_STORE_NAME);
                        var ok = 0, fail = 0, total = paths.length;

                        function finish() {
                            if (fail == 0) onload(); else onerror()
                        }

                        paths.forEach(function (path) {
                            var putRequest = files.put(FS.analyzePath(path).object.contents, path);
                            putRequest.onsuccess = function putRequest_onsuccess() {
                                ok++;
                                if (ok + fail == total) finish()
                            };
                            putRequest.onerror = function putRequest_onerror() {
                                fail++;
                                if (ok + fail == total) finish()
                            }
                        });
                        transaction.onerror = onerror
                    };
                    openRequest.onerror = onerror
                },
                loadFilesFromDB: function (paths, onload, onerror) {
                    onload = onload || function () {
                    };
                    onerror = onerror || function () {
                    };
                    var indexedDB = FS.indexedDB();
                    try {
                        var openRequest = indexedDB.open(FS.DB_NAME(), FS.DB_VERSION)
                    } catch (e) {
                        return onerror(e)
                    }
                    openRequest.onupgradeneeded = onerror;
                    openRequest.onsuccess = function openRequest_onsuccess() {
                        var db = openRequest.result;
                        try {
                            var transaction = db.transaction([FS.DB_STORE_NAME], "readonly")
                        } catch (e) {
                            onerror(e);
                            return
                        }
                        var files = transaction.objectStore(FS.DB_STORE_NAME);
                        var ok = 0, fail = 0, total = paths.length;

                        function finish() {
                            if (fail == 0) onload(); else onerror()
                        }

                        paths.forEach(function (path) {
                            var getRequest = files.get(path);
                            getRequest.onsuccess = function getRequest_onsuccess() {
                                if (FS.analyzePath(path).exists) {
                                    FS.unlink(path)
                                }
                                FS.createDataFile(PATH.dirname(path), PATH.basename(path), getRequest.result, true, true, true);
                                ok++;
                                if (ok + fail == total) finish()
                            };
                            getRequest.onerror = function getRequest_onerror() {
                                fail++;
                                if (ok + fail == total) finish()
                            }
                        });
                        transaction.onerror = onerror
                    };
                    openRequest.onerror = onerror
                }
            };
            var ERRNO_CODES = {
                EPERM: 1,
                ENOENT: 2,
                ESRCH: 3,
                EINTR: 4,
                EIO: 5,
                ENXIO: 6,
                E2BIG: 7,
                ENOEXEC: 8,
                EBADF: 9,
                ECHILD: 10,
                EAGAIN: 11,
                EWOULDBLOCK: 11,
                ENOMEM: 12,
                EACCES: 13,
                EFAULT: 14,
                ENOTBLK: 15,
                EBUSY: 16,
                EEXIST: 17,
                EXDEV: 18,
                ENODEV: 19,
                ENOTDIR: 20,
                EISDIR: 21,
                EINVAL: 22,
                ENFILE: 23,
                EMFILE: 24,
                ENOTTY: 25,
                ETXTBSY: 26,
                EFBIG: 27,
                ENOSPC: 28,
                ESPIPE: 29,
                EROFS: 30,
                EMLINK: 31,
                EPIPE: 32,
                EDOM: 33,
                ERANGE: 34,
                ENOMSG: 42,
                EIDRM: 43,
                ECHRNG: 44,
                EL2NSYNC: 45,
                EL3HLT: 46,
                EL3RST: 47,
                ELNRNG: 48,
                EUNATCH: 49,
                ENOCSI: 50,
                EL2HLT: 51,
                EDEADLK: 35,
                ENOLCK: 37,
                EBADE: 52,
                EBADR: 53,
                EXFULL: 54,
                ENOANO: 55,
                EBADRQC: 56,
                EBADSLT: 57,
                EDEADLOCK: 35,
                EBFONT: 59,
                ENOSTR: 60,
                ENODATA: 61,
                ETIME: 62,
                ENOSR: 63,
                ENONET: 64,
                ENOPKG: 65,
                EREMOTE: 66,
                ENOLINK: 67,
                EADV: 68,
                ESRMNT: 69,
                ECOMM: 70,
                EPROTO: 71,
                EMULTIHOP: 72,
                EDOTDOT: 73,
                EBADMSG: 74,
                ENOTUNIQ: 76,
                EBADFD: 77,
                EREMCHG: 78,
                ELIBACC: 79,
                ELIBBAD: 80,
                ELIBSCN: 81,
                ELIBMAX: 82,
                ELIBEXEC: 83,
                ENOSYS: 38,
                ENOTEMPTY: 39,
                ENAMETOOLONG: 36,
                ELOOP: 40,
                EOPNOTSUPP: 95,
                EPFNOSUPPORT: 96,
                ECONNRESET: 104,
                ENOBUFS: 105,
                EAFNOSUPPORT: 97,
                EPROTOTYPE: 91,
                ENOTSOCK: 88,
                ENOPROTOOPT: 92,
                ESHUTDOWN: 108,
                ECONNREFUSED: 111,
                EADDRINUSE: 98,
                ECONNABORTED: 103,
                ENETUNREACH: 101,
                ENETDOWN: 100,
                ETIMEDOUT: 110,
                EHOSTDOWN: 112,
                EHOSTUNREACH: 113,
                EINPROGRESS: 115,
                EALREADY: 114,
                EDESTADDRREQ: 89,
                EMSGSIZE: 90,
                EPROTONOSUPPORT: 93,
                ESOCKTNOSUPPORT: 94,
                EADDRNOTAVAIL: 99,
                ENETRESET: 102,
                EISCONN: 106,
                ENOTCONN: 107,
                ETOOMANYREFS: 109,
                EUSERS: 87,
                EDQUOT: 122,
                ESTALE: 116,
                ENOTSUP: 95,
                ENOMEDIUM: 123,
                EILSEQ: 84,
                EOVERFLOW: 75,
                ECANCELED: 125,
                ENOTRECOVERABLE: 131,
                EOWNERDEAD: 130,
                ESTRPIPE: 86
            };
            var SYSCALLS = {
                DEFAULT_POLLMASK: 5, mappings: {}, umask: 511, calculateAt: function (dirfd, path) {
                    if (path[0] !== "/") {
                        var dir;
                        if (dirfd === -100) {
                            dir = FS.cwd()
                        } else {
                            var dirstream = FS.getStream(dirfd);
                            if (!dirstream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
                            dir = dirstream.path
                        }
                        path = PATH.join2(dir, path)
                    }
                    return path
                }, doStat: function (func, path, buf) {
                    try {
                        var stat = func(path)
                    } catch (e) {
                        if (e && e.node && PATH.normalize(path) !== PATH.normalize(FS.getPath(e.node))) {
                            return -ERRNO_CODES.ENOTDIR
                        }
                        throw e
                    }
                    HEAP32[buf >> 2] = stat.dev;
                    HEAP32[buf + 4 >> 2] = 0;
                    HEAP32[buf + 8 >> 2] = stat.ino;
                    HEAP32[buf + 12 >> 2] = stat.mode;
                    HEAP32[buf + 16 >> 2] = stat.nlink;
                    HEAP32[buf + 20 >> 2] = stat.uid;
                    HEAP32[buf + 24 >> 2] = stat.gid;
                    HEAP32[buf + 28 >> 2] = stat.rdev;
                    HEAP32[buf + 32 >> 2] = 0;
                    HEAP32[buf + 36 >> 2] = stat.size;
                    HEAP32[buf + 40 >> 2] = 4096;
                    HEAP32[buf + 44 >> 2] = stat.blocks;
                    HEAP32[buf + 48 >> 2] = stat.atime.getTime() / 1e3 | 0;
                    HEAP32[buf + 52 >> 2] = 0;
                    HEAP32[buf + 56 >> 2] = stat.mtime.getTime() / 1e3 | 0;
                    HEAP32[buf + 60 >> 2] = 0;
                    HEAP32[buf + 64 >> 2] = stat.ctime.getTime() / 1e3 | 0;
                    HEAP32[buf + 68 >> 2] = 0;
                    HEAP32[buf + 72 >> 2] = stat.ino;
                    return 0
                }, doMsync: function (addr, stream, len, flags) {
                    var buffer = new Uint8Array(HEAPU8.subarray(addr, addr + len));
                    FS.msync(stream, buffer, 0, len, flags)
                }, doMkdir: function (path, mode) {
                    path = PATH.normalize(path);
                    if (path[path.length - 1] === "/") path = path.substr(0, path.length - 1);
                    FS.mkdir(path, mode, 0);
                    return 0
                }, doMknod: function (path, mode, dev) {
                    switch (mode & 61440) {
                        case 32768:
                        case 8192:
                        case 24576:
                        case 4096:
                        case 49152:
                            break;
                        default:
                            return -ERRNO_CODES.EINVAL
                    }
                    FS.mknod(path, mode, dev);
                    return 0
                }, doReadlink: function (path, buf, bufsize) {
                    if (bufsize <= 0) return -ERRNO_CODES.EINVAL;
                    var ret = FS.readlink(path);
                    var len = Math.min(bufsize, lengthBytesUTF8(ret));
                    var endChar = HEAP8[buf + len];
                    stringToUTF8(ret, buf, bufsize + 1);
                    HEAP8[buf + len] = endChar;
                    return len
                }, doAccess: function (path, amode) {
                    if (amode & ~7) {
                        return -ERRNO_CODES.EINVAL
                    }
                    var node;
                    var lookup = FS.lookupPath(path, {follow: true});
                    node = lookup.node;
                    var perms = "";
                    if (amode & 4) perms += "r";
                    if (amode & 2) perms += "w";
                    if (amode & 1) perms += "x";
                    if (perms && FS.nodePermissions(node, perms)) {
                        return -ERRNO_CODES.EACCES
                    }
                    return 0
                }, doDup: function (path, flags, suggestFD) {
                    var suggest = FS.getStream(suggestFD);
                    if (suggest) FS.close(suggest);
                    return FS.open(path, flags, 0, suggestFD, suggestFD).fd
                }, doReadv: function (stream, iov, iovcnt, offset) {
                    var ret = 0;
                    for (var i = 0; i < iovcnt; i++) {
                        var ptr = HEAP32[iov + i * 8 >> 2];
                        var len = HEAP32[iov + (i * 8 + 4) >> 2];
                        var curr = FS.read(stream, HEAP8, ptr, len, offset);
                        if (curr < 0) return -1;
                        ret += curr;
                        if (curr < len) break
                    }
                    return ret
                }, doWritev: function (stream, iov, iovcnt, offset) {
                    var ret = 0;
                    for (var i = 0; i < iovcnt; i++) {
                        var ptr = HEAP32[iov + i * 8 >> 2];
                        var len = HEAP32[iov + (i * 8 + 4) >> 2];
                        var curr = FS.write(stream, HEAP8, ptr, len, offset);
                        if (curr < 0) return -1;
                        ret += curr
                    }
                    return ret
                }, varargs: 0, get: function (varargs) {
                    SYSCALLS.varargs += 4;
                    var ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
                    return ret
                }, getStr: function () {
                    var ret = UTF8ToString(SYSCALLS.get());
                    return ret
                }, getStreamFromFD: function () {
                    var stream = FS.getStream(SYSCALLS.get());
                    if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
                    return stream
                }, getSocketFromFD: function () {
                    var socket = SOCKFS.getSocket(SYSCALLS.get());
                    if (!socket) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
                    return socket
                }, getSocketAddress: function (allowNull) {
                    var addrp = SYSCALLS.get(), addrlen = SYSCALLS.get();
                    if (allowNull && addrp === 0) return null;
                    var info = __read_sockaddr(addrp, addrlen);
                    if (info.errno) throw new FS.ErrnoError(info.errno);
                    info.addr = DNS.lookup_addr(info.addr) || info.addr;
                    return info
                }, get64: function () {
                    var low = SYSCALLS.get(), high = SYSCALLS.get();
                    return low
                }, getZero: function () {
                    SYSCALLS.get()
                }
            };

            function ___syscall10(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var path = SYSCALLS.getStr();
                    FS.unlink(path);
                    return 0
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall140(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(),
                        result = SYSCALLS.get(), whence = SYSCALLS.get();
                    var offset = offset_low;
                    FS.llseek(stream, offset, whence);
                    HEAP32[result >> 2] = stream.position;
                    if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null;
                    return 0
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall142(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var nfds = SYSCALLS.get(), readfds = SYSCALLS.get(), writefds = SYSCALLS.get(),
                        exceptfds = SYSCALLS.get(), timeout = SYSCALLS.get();
                    var total = 0;
                    var srcReadLow = readfds ? HEAP32[readfds >> 2] : 0,
                        srcReadHigh = readfds ? HEAP32[readfds + 4 >> 2] : 0;
                    var srcWriteLow = writefds ? HEAP32[writefds >> 2] : 0,
                        srcWriteHigh = writefds ? HEAP32[writefds + 4 >> 2] : 0;
                    var srcExceptLow = exceptfds ? HEAP32[exceptfds >> 2] : 0,
                        srcExceptHigh = exceptfds ? HEAP32[exceptfds + 4 >> 2] : 0;
                    var dstReadLow = 0, dstReadHigh = 0;
                    var dstWriteLow = 0, dstWriteHigh = 0;
                    var dstExceptLow = 0, dstExceptHigh = 0;
                    var allLow = (readfds ? HEAP32[readfds >> 2] : 0) | (writefds ? HEAP32[writefds >> 2] : 0) | (exceptfds ? HEAP32[exceptfds >> 2] : 0);
                    var allHigh = (readfds ? HEAP32[readfds + 4 >> 2] : 0) | (writefds ? HEAP32[writefds + 4 >> 2] : 0) | (exceptfds ? HEAP32[exceptfds + 4 >> 2] : 0);
                    var check = function (fd, low, high, val) {
                        return fd < 32 ? low & val : high & val
                    };
                    for (var fd = 0; fd < nfds; fd++) {
                        var mask = 1 << fd % 32;
                        if (!check(fd, allLow, allHigh, mask)) {
                            continue
                        }
                        var stream = FS.getStream(fd);
                        if (!stream) throw new FS.ErrnoError(ERRNO_CODES.EBADF);
                        var flags = SYSCALLS.DEFAULT_POLLMASK;
                        if (stream.stream_ops.poll) {
                            flags = stream.stream_ops.poll(stream)
                        }
                        if (flags & 1 && check(fd, srcReadLow, srcReadHigh, mask)) {
                            fd < 32 ? dstReadLow = dstReadLow | mask : dstReadHigh = dstReadHigh | mask;
                            total++
                        }
                        if (flags & 4 && check(fd, srcWriteLow, srcWriteHigh, mask)) {
                            fd < 32 ? dstWriteLow = dstWriteLow | mask : dstWriteHigh = dstWriteHigh | mask;
                            total++
                        }
                        if (flags & 2 && check(fd, srcExceptLow, srcExceptHigh, mask)) {
                            fd < 32 ? dstExceptLow = dstExceptLow | mask : dstExceptHigh = dstExceptHigh | mask;
                            total++
                        }
                    }
                    if (readfds) {
                        HEAP32[readfds >> 2] = dstReadLow;
                        HEAP32[readfds + 4 >> 2] = dstReadHigh
                    }
                    if (writefds) {
                        HEAP32[writefds >> 2] = dstWriteLow;
                        HEAP32[writefds + 4 >> 2] = dstWriteHigh
                    }
                    if (exceptfds) {
                        HEAP32[exceptfds >> 2] = dstExceptLow;
                        HEAP32[exceptfds + 4 >> 2] = dstExceptHigh
                    }
                    return total
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall145(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
                    return SYSCALLS.doReadv(stream, iov, iovcnt)
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall146(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var stream = SYSCALLS.getStreamFromFD(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
                    return SYSCALLS.doWritev(stream, iov, iovcnt)
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall195(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var path = SYSCALLS.getStr(), buf = SYSCALLS.get();
                    return SYSCALLS.doStat(FS.stat, path, buf)
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall196(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var path = SYSCALLS.getStr(), buf = SYSCALLS.get();
                    return SYSCALLS.doStat(FS.lstat, path, buf)
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall197(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var stream = SYSCALLS.getStreamFromFD(), buf = SYSCALLS.get();
                    return SYSCALLS.doStat(FS.stat, stream.path, buf)
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall219(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    return 0
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall220(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var stream = SYSCALLS.getStreamFromFD(), dirp = SYSCALLS.get(), count = SYSCALLS.get();
                    if (!stream.getdents) {
                        stream.getdents = FS.readdir(stream.path)
                    }
                    var pos = 0;
                    while (stream.getdents.length > 0 && pos + 268 <= count) {
                        var id;
                        var type;
                        var name = stream.getdents.pop();
                        if (name[0] === ".") {
                            id = 1;
                            type = 4
                        } else {
                            var child = FS.lookupNode(stream.node, name);
                            id = child.id;
                            type = FS.isChrdev(child.mode) ? 2 : FS.isDir(child.mode) ? 4 : FS.isLink(child.mode) ? 10 : 8
                        }
                        HEAP32[dirp + pos >> 2] = id;
                        HEAP32[dirp + pos + 4 >> 2] = stream.position;
                        HEAP16[dirp + pos + 8 >> 1] = 268;
                        HEAP8[dirp + pos + 10 >> 0] = type;
                        stringToUTF8(name, dirp + pos + 11, 256);
                        pos += 268
                    }
                    return pos
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall221(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var stream = SYSCALLS.getStreamFromFD(), cmd = SYSCALLS.get();
                    switch (cmd) {
                        case 0: {
                            var arg = SYSCALLS.get();
                            if (arg < 0) {
                                return -ERRNO_CODES.EINVAL
                            }
                            var newStream;
                            newStream = FS.open(stream.path, stream.flags, 0, arg);
                            return newStream.fd
                        }
                        case 1:
                        case 2:
                            return 0;
                        case 3:
                            return stream.flags;
                        case 4: {
                            var arg = SYSCALLS.get();
                            stream.flags |= arg;
                            return 0
                        }
                        case 12: {
                            var arg = SYSCALLS.get();
                            var offset = 0;
                            HEAP16[arg + offset >> 1] = 2;
                            return 0
                        }
                        case 13:
                        case 14:
                            return 0;
                        case 16:
                        case 8:
                            return -ERRNO_CODES.EINVAL;
                        case 9:
                            ___setErrNo(ERRNO_CODES.EINVAL);
                            return -1;
                        default: {
                            return -ERRNO_CODES.EINVAL
                        }
                    }
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall3(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var stream = SYSCALLS.getStreamFromFD(), buf = SYSCALLS.get(), count = SYSCALLS.get();
                    return FS.read(stream, HEAP8, buf, count)
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall33(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var path = SYSCALLS.getStr(), amode = SYSCALLS.get();
                    return SYSCALLS.doAccess(path, amode)
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall340(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var pid = SYSCALLS.get(), resource = SYSCALLS.get(), new_limit = SYSCALLS.get(),
                        old_limit = SYSCALLS.get();
                    if (old_limit) {
                        HEAP32[old_limit >> 2] = -1;
                        HEAP32[old_limit + 4 >> 2] = -1;
                        HEAP32[old_limit + 8 >> 2] = -1;
                        HEAP32[old_limit + 12 >> 2] = -1
                    }
                    return 0
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall38(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var old_path = SYSCALLS.getStr(), new_path = SYSCALLS.getStr();
                    FS.rename(old_path, new_path);
                    return 0
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall4(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var stream = SYSCALLS.getStreamFromFD(), buf = SYSCALLS.get(), count = SYSCALLS.get();
                    return FS.write(stream, HEAP8, buf, count)
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall40(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var path = SYSCALLS.getStr();
                    FS.rmdir(path);
                    return 0
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall5(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var pathname = SYSCALLS.getStr(), flags = SYSCALLS.get(), mode = SYSCALLS.get();
                    var stream = FS.open(pathname, flags, mode);
                    return stream.fd
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall54(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var stream = SYSCALLS.getStreamFromFD(), op = SYSCALLS.get();
                    switch (op) {
                        case 21509:
                        case 21505: {
                            if (!stream.tty) return -ERRNO_CODES.ENOTTY;
                            return 0
                        }
                        case 21510:
                        case 21511:
                        case 21512:
                        case 21506:
                        case 21507:
                        case 21508: {
                            if (!stream.tty) return -ERRNO_CODES.ENOTTY;
                            return 0
                        }
                        case 21519: {
                            if (!stream.tty) return -ERRNO_CODES.ENOTTY;
                            var argp = SYSCALLS.get();
                            HEAP32[argp >> 2] = 0;
                            return 0
                        }
                        case 21520: {
                            if (!stream.tty) return -ERRNO_CODES.ENOTTY;
                            return -ERRNO_CODES.EINVAL
                        }
                        case 21531: {
                            var argp = SYSCALLS.get();
                            return FS.ioctl(stream, op, argp)
                        }
                        case 21523: {
                            if (!stream.tty) return -ERRNO_CODES.ENOTTY;
                            return 0
                        }
                        case 21524: {
                            if (!stream.tty) return -ERRNO_CODES.ENOTTY;
                            return 0
                        }
                        default:
                            abort("bad ioctl syscall " + op)
                    }
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall6(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var stream = SYSCALLS.getStreamFromFD();
                    FS.close(stream);
                    return 0
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall75(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    return 0
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___syscall77(which, varargs) {
                SYSCALLS.varargs = varargs;
                try {
                    var who = SYSCALLS.get(), usage = SYSCALLS.get();
                    _memset(usage, 0, 136);
                    HEAP32[usage >> 2] = 1;
                    HEAP32[usage + 4 >> 2] = 2;
                    HEAP32[usage + 8 >> 2] = 3;
                    HEAP32[usage + 12 >> 2] = 4;
                    return 0
                } catch (e) {
                    if (typeof FS === "undefined" || !(e instanceof FS.ErrnoError)) abort(e);
                    return -e.errno
                }
            }

            function ___unlock() {
            }

            function _abort() {
                Module["abort"]()
            }

            function _clock() {
                if (_clock.start === undefined) _clock.start = Date.now();
                return (Date.now() - _clock.start) * (1e6 / 1e3) | 0
            }

            function _emscripten_get_now() {
                abort()
            }

            function _emscripten_get_now_is_monotonic() {
                return 0 || ENVIRONMENT_IS_NODE || typeof dateNow !== "undefined" || typeof performance === "object" && performance && typeof performance["now"] === "function"
            }

            function _clock_gettime(clk_id, tp) {
                var now;
                if (clk_id === 0) {
                    now = Date.now()
                } else if (clk_id === 1 && _emscripten_get_now_is_monotonic()) {
                    now = _emscripten_get_now()
                } else {
                    ___setErrNo(22);
                    return -1
                }
                HEAP32[tp >> 2] = now / 1e3 | 0;
                HEAP32[tp + 4 >> 2] = now % 1e3 * 1e3 * 1e3 | 0;
                return 0
            }

            function _emscripten_set_main_loop_timing(mode, value) {
                Browser.mainLoop.timingMode = mode;
                Browser.mainLoop.timingValue = value;
                if (!Browser.mainLoop.func) {
                    return 1
                }
                if (mode == 0) {
                    Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setTimeout() {
                        var timeUntilNextTick = Math.max(0, Browser.mainLoop.tickStartTime + value - _emscripten_get_now()) | 0;
                        setTimeout(Browser.mainLoop.runner, timeUntilNextTick)
                    };
                    Browser.mainLoop.method = "timeout"
                } else if (mode == 1) {
                    Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_rAF() {
                        Browser.requestAnimationFrame(Browser.mainLoop.runner)
                    };
                    Browser.mainLoop.method = "rAF"
                } else if (mode == 2) {
                    if (typeof setImmediate === "undefined") {
                        var setImmediates = [];
                        var emscriptenMainLoopMessageId = "setimmediate";
                        var Browser_setImmediate_messageHandler = function (event) {
                            if (event.data === emscriptenMainLoopMessageId || event.data.target === emscriptenMainLoopMessageId) {
                                event.stopPropagation();
                                setImmediates.shift()()
                            }
                        };
                        addEventListener("message", Browser_setImmediate_messageHandler, true);
                        setImmediate = function Browser_emulated_setImmediate(func) {
                            setImmediates.push(func);
                            if (ENVIRONMENT_IS_WORKER) {
                                if (Module["setImmediates"] === undefined) Module["setImmediates"] = [];
                                Module["setImmediates"].push(func);
                                postMessage({target: emscriptenMainLoopMessageId})
                            } else postMessage(emscriptenMainLoopMessageId, "*")
                        }
                    }
                    Browser.mainLoop.scheduler = function Browser_mainLoop_scheduler_setImmediate() {
                        setImmediate(Browser.mainLoop.runner)
                    };
                    Browser.mainLoop.method = "immediate"
                }
                return 0
            }

            function _emscripten_set_main_loop(func, fps, simulateInfiniteLoop, arg, noSetTiming) {
                Module["noExitRuntime"] = true;
                assert(!Browser.mainLoop.func, "emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.");
                Browser.mainLoop.func = func;
                Browser.mainLoop.arg = arg;
                var browserIterationFunc;
                if (typeof arg !== "undefined") {
                    browserIterationFunc = function () {
                        Module["dynCall_vi"](func, arg)
                    }
                } else {
                    browserIterationFunc = function () {
                        Module["dynCall_v"](func)
                    }
                }
                var thisMainLoopId = Browser.mainLoop.currentlyRunningMainloop;
                Browser.mainLoop.runner = function Browser_mainLoop_runner() {
                    if (ABORT) return;
                    if (Browser.mainLoop.queue.length > 0) {
                        var start = Date.now();
                        var blocker = Browser.mainLoop.queue.shift();
                        blocker.func(blocker.arg);
                        if (Browser.mainLoop.remainingBlockers) {
                            var remaining = Browser.mainLoop.remainingBlockers;
                            var next = remaining % 1 == 0 ? remaining - 1 : Math.floor(remaining);
                            if (blocker.counted) {
                                Browser.mainLoop.remainingBlockers = next
                            } else {
                                next = next + .5;
                                Browser.mainLoop.remainingBlockers = (8 * remaining + next) / 9
                            }
                        }
                        console.log('main loop blocker "' + blocker.name + '" took ' + (Date.now() - start) + " ms");
                        Browser.mainLoop.updateStatus();
                        if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
                        setTimeout(Browser.mainLoop.runner, 0);
                        return
                    }
                    if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
                    Browser.mainLoop.currentFrameNumber = Browser.mainLoop.currentFrameNumber + 1 | 0;
                    if (Browser.mainLoop.timingMode == 1 && Browser.mainLoop.timingValue > 1 && Browser.mainLoop.currentFrameNumber % Browser.mainLoop.timingValue != 0) {
                        Browser.mainLoop.scheduler();
                        return
                    } else if (Browser.mainLoop.timingMode == 0) {
                        Browser.mainLoop.tickStartTime = _emscripten_get_now()
                    }
                    if (Browser.mainLoop.method === "timeout" && Module.ctx) {
                        err("Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!");
                        Browser.mainLoop.method = ""
                    }
                    Browser.mainLoop.runIter(browserIterationFunc);
                    if (thisMainLoopId < Browser.mainLoop.currentlyRunningMainloop) return;
                    if (typeof SDL === "object" && SDL.audio && SDL.audio.queueNewAudioData) SDL.audio.queueNewAudioData();
                    Browser.mainLoop.scheduler()
                };
                if (!noSetTiming) {
                    if (fps && fps > 0) _emscripten_set_main_loop_timing(0, 1e3 / fps); else _emscripten_set_main_loop_timing(1, 1);
                    Browser.mainLoop.scheduler()
                }
                if (simulateInfiniteLoop) {
                    throw"SimulateInfiniteLoop"
                }
            }

            var Browser = {
                mainLoop: {
                    scheduler: null,
                    method: "",
                    currentlyRunningMainloop: 0,
                    func: null,
                    arg: 0,
                    timingMode: 0,
                    timingValue: 0,
                    currentFrameNumber: 0,
                    queue: [],
                    pause: function () {
                        Browser.mainLoop.scheduler = null;
                        Browser.mainLoop.currentlyRunningMainloop++
                    },
                    resume: function () {
                        Browser.mainLoop.currentlyRunningMainloop++;
                        var timingMode = Browser.mainLoop.timingMode;
                        var timingValue = Browser.mainLoop.timingValue;
                        var func = Browser.mainLoop.func;
                        Browser.mainLoop.func = null;
                        _emscripten_set_main_loop(func, 0, false, Browser.mainLoop.arg, true);
                        _emscripten_set_main_loop_timing(timingMode, timingValue);
                        Browser.mainLoop.scheduler()
                    },
                    updateStatus: function () {
                        if (Module["setStatus"]) {
                            var message = Module["statusMessage"] || "Please wait...";
                            var remaining = Browser.mainLoop.remainingBlockers;
                            var expected = Browser.mainLoop.expectedBlockers;
                            if (remaining) {
                                if (remaining < expected) {
                                    Module["setStatus"](message + " (" + (expected - remaining) + "/" + expected + ")")
                                } else {
                                    Module["setStatus"](message)
                                }
                            } else {
                                Module["setStatus"]("")
                            }
                        }
                    },
                    runIter: function (func) {
                        if (ABORT) return;
                        if (Module["preMainLoop"]) {
                            var preRet = Module["preMainLoop"]();
                            if (preRet === false) {
                                return
                            }
                        }
                        try {
                            func()
                        } catch (e) {
                            if (e instanceof ExitStatus) {
                                return
                            } else {
                                if (e && typeof e === "object" && e.stack) err("exception thrown: " + [e, e.stack]);
                                throw e
                            }
                        }
                        if (Module["postMainLoop"]) Module["postMainLoop"]()
                    }
                },
                isFullscreen: false,
                pointerLock: false,
                moduleContextCreatedCallbacks: [],
                workers: [],
                init: function () {
                    if (!Module["preloadPlugins"]) Module["preloadPlugins"] = [];
                    if (Browser.initted) return;
                    Browser.initted = true;
                    try {
                        new Blob;
                        Browser.hasBlobConstructor = true
                    } catch (e) {
                        Browser.hasBlobConstructor = false;
                        console.log("warning: no blob constructor, cannot create blobs with mimetypes")
                    }
                    Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : !Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null;
                    Browser.URLObject = typeof window != "undefined" ? window.URL ? window.URL : window.webkitURL : undefined;
                    if (!Module.noImageDecoding && typeof Browser.URLObject === "undefined") {
                        console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");
                        Module.noImageDecoding = true
                    }
                    var imagePlugin = {};
                    imagePlugin["canHandle"] = function imagePlugin_canHandle(name) {
                        return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/i.test(name)
                    };
                    imagePlugin["handle"] = function imagePlugin_handle(byteArray, name, onload, onerror) {
                        var b = null;
                        if (Browser.hasBlobConstructor) {
                            try {
                                b = new Blob([byteArray], {type: Browser.getMimetype(name)});
                                if (b.size !== byteArray.length) {
                                    b = new Blob([new Uint8Array(byteArray).buffer], {type: Browser.getMimetype(name)})
                                }
                            } catch (e) {
                                warnOnce("Blob constructor present but fails: " + e + "; falling back to blob builder")
                            }
                        }
                        if (!b) {
                            var bb = new Browser.BlobBuilder;
                            bb.append(new Uint8Array(byteArray).buffer);
                            b = bb.getBlob()
                        }
                        var url = Browser.URLObject.createObjectURL(b);
                        var img = new Image;
                        img.onload = function img_onload() {
                            assert(img.complete, "Image " + name + " could not be decoded");
                            var canvas = document.createElement("canvas");
                            canvas.width = img.width;
                            canvas.height = img.height;
                            var ctx = canvas.getContext("2d");
                            ctx.drawImage(img, 0, 0);
                            Module["preloadedImages"][name] = canvas;
                            Browser.URLObject.revokeObjectURL(url);
                            if (onload) onload(byteArray)
                        };
                        img.onerror = function img_onerror(event) {
                            console.log("Image " + url + " could not be decoded");
                            if (onerror) onerror()
                        };
                        img.src = url
                    };
                    Module["preloadPlugins"].push(imagePlugin);
                    var audioPlugin = {};
                    audioPlugin["canHandle"] = function audioPlugin_canHandle(name) {
                        return !Module.noAudioDecoding && name.substr(-4) in {".ogg": 1, ".wav": 1, ".mp3": 1}
                    };
                    audioPlugin["handle"] = function audioPlugin_handle(byteArray, name, onload, onerror) {
                        var done = false;

                        function finish(audio) {
                            if (done) return;
                            done = true;
                            Module["preloadedAudios"][name] = audio;
                            if (onload) onload(byteArray)
                        }

                        function fail() {
                            if (done) return;
                            done = true;
                            Module["preloadedAudios"][name] = new Audio;
                            if (onerror) onerror()
                        }

                        if (Browser.hasBlobConstructor) {
                            try {
                                var b = new Blob([byteArray], {type: Browser.getMimetype(name)})
                            } catch (e) {
                                return fail()
                            }
                            var url = Browser.URLObject.createObjectURL(b);
                            var audio = new Audio;
                            audio.addEventListener("canplaythrough", function () {
                                finish(audio)
                            }, false);
                            audio.onerror = function audio_onerror(event) {
                                if (done) return;
                                console.log("warning: browser could not fully decode audio " + name + ", trying slower base64 approach");

                                function encode64(data) {
                                    var BASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                                    var PAD = "=";
                                    var ret = "";
                                    var leftchar = 0;
                                    var leftbits = 0;
                                    for (var i = 0; i < data.length; i++) {
                                        leftchar = leftchar << 8 | data[i];
                                        leftbits += 8;
                                        while (leftbits >= 6) {
                                            var curr = leftchar >> leftbits - 6 & 63;
                                            leftbits -= 6;
                                            ret += BASE[curr]
                                        }
                                    }
                                    if (leftbits == 2) {
                                        ret += BASE[(leftchar & 3) << 4];
                                        ret += PAD + PAD
                                    } else if (leftbits == 4) {
                                        ret += BASE[(leftchar & 15) << 2];
                                        ret += PAD
                                    }
                                    return ret
                                }

                                audio.src = "data:audio/x-" + name.substr(-3) + ";base64," + encode64(byteArray);
                                finish(audio)
                            };
                            audio.src = url;
                            Browser.safeSetTimeout(function () {
                                finish(audio)
                            }, 1e4)
                        } else {
                            return fail()
                        }
                    };
                    Module["preloadPlugins"].push(audioPlugin);

                    function pointerLockChange() {
                        Browser.pointerLock = document["pointerLockElement"] === Module["canvas"] || document["mozPointerLockElement"] === Module["canvas"] || document["webkitPointerLockElement"] === Module["canvas"] || document["msPointerLockElement"] === Module["canvas"]
                    }

                    var canvas = Module["canvas"];
                    if (canvas) {
                        canvas.requestPointerLock = canvas["requestPointerLock"] || canvas["mozRequestPointerLock"] || canvas["webkitRequestPointerLock"] || canvas["msRequestPointerLock"] || function () {
                        };
                        canvas.exitPointerLock = document["exitPointerLock"] || document["mozExitPointerLock"] || document["webkitExitPointerLock"] || document["msExitPointerLock"] || function () {
                        };
                        canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
                        document.addEventListener("pointerlockchange", pointerLockChange, false);
                        document.addEventListener("mozpointerlockchange", pointerLockChange, false);
                        document.addEventListener("webkitpointerlockchange", pointerLockChange, false);
                        document.addEventListener("mspointerlockchange", pointerLockChange, false);
                        if (Module["elementPointerLock"]) {
                            canvas.addEventListener("click", function (ev) {
                                if (!Browser.pointerLock && Module["canvas"].requestPointerLock) {
                                    Module["canvas"].requestPointerLock();
                                    ev.preventDefault()
                                }
                            }, false)
                        }
                    }
                },
                createContext: function (canvas, useWebGL, setInModule, webGLContextAttributes) {
                    if (useWebGL && Module.ctx && canvas == Module.canvas) return Module.ctx;
                    var ctx;
                    var contextHandle;
                    if (useWebGL) {
                        var contextAttributes = {antialias: false, alpha: false, majorVersion: 1};
                        if (webGLContextAttributes) {
                            for (var attribute in webGLContextAttributes) {
                                contextAttributes[attribute] = webGLContextAttributes[attribute]
                            }
                        }
                        if (typeof GL !== "undefined") {
                            contextHandle = GL.createContext(canvas, contextAttributes);
                            if (contextHandle) {
                                ctx = GL.getContext(contextHandle).GLctx
                            }
                        }
                    } else {
                        ctx = canvas.getContext("2d")
                    }
                    if (!ctx) return null;
                    if (setInModule) {
                        if (!useWebGL) assert(typeof GLctx === "undefined", "cannot set in module if GLctx is used, but we are a non-GL context that would replace it");
                        Module.ctx = ctx;
                        if (useWebGL) GL.makeContextCurrent(contextHandle);
                        Module.useWebGL = useWebGL;
                        Browser.moduleContextCreatedCallbacks.forEach(function (callback) {
                            callback()
                        });
                        Browser.init()
                    }
                    return ctx
                },
                destroyContext: function (canvas, useWebGL, setInModule) {
                },
                fullscreenHandlersInstalled: false,
                lockPointer: undefined,
                resizeCanvas: undefined,
                requestFullscreen: function (lockPointer, resizeCanvas, vrDevice) {
                    Browser.lockPointer = lockPointer;
                    Browser.resizeCanvas = resizeCanvas;
                    Browser.vrDevice = vrDevice;
                    if (typeof Browser.lockPointer === "undefined") Browser.lockPointer = true;
                    if (typeof Browser.resizeCanvas === "undefined") Browser.resizeCanvas = false;
                    if (typeof Browser.vrDevice === "undefined") Browser.vrDevice = null;
                    var canvas = Module["canvas"];

                    function fullscreenChange() {
                        Browser.isFullscreen = false;
                        var canvasContainer = canvas.parentNode;
                        if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvasContainer) {
                            canvas.exitFullscreen = Browser.exitFullscreen;
                            if (Browser.lockPointer) canvas.requestPointerLock();
                            Browser.isFullscreen = true;
                            if (Browser.resizeCanvas) {
                                Browser.setFullscreenCanvasSize()
                            } else {
                                Browser.updateCanvasDimensions(canvas)
                            }
                        } else {
                            canvasContainer.parentNode.insertBefore(canvas, canvasContainer);
                            canvasContainer.parentNode.removeChild(canvasContainer);
                            if (Browser.resizeCanvas) {
                                Browser.setWindowedCanvasSize()
                            } else {
                                Browser.updateCanvasDimensions(canvas)
                            }
                        }
                        if (Module["onFullScreen"]) Module["onFullScreen"](Browser.isFullscreen);
                        if (Module["onFullscreen"]) Module["onFullscreen"](Browser.isFullscreen)
                    }

                    if (!Browser.fullscreenHandlersInstalled) {
                        Browser.fullscreenHandlersInstalled = true;
                        document.addEventListener("fullscreenchange", fullscreenChange, false);
                        document.addEventListener("mozfullscreenchange", fullscreenChange, false);
                        document.addEventListener("webkitfullscreenchange", fullscreenChange, false);
                        document.addEventListener("MSFullscreenChange", fullscreenChange, false)
                    }
                    var canvasContainer = document.createElement("div");
                    canvas.parentNode.insertBefore(canvasContainer, canvas);
                    canvasContainer.appendChild(canvas);
                    canvasContainer.requestFullscreen = canvasContainer["requestFullscreen"] || canvasContainer["mozRequestFullScreen"] || canvasContainer["msRequestFullscreen"] || (canvasContainer["webkitRequestFullscreen"] ? function () {
                        canvasContainer["webkitRequestFullscreen"](Element["ALLOW_KEYBOARD_INPUT"])
                    } : null) || (canvasContainer["webkitRequestFullScreen"] ? function () {
                        canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"])
                    } : null);
                    if (vrDevice) {
                        canvasContainer.requestFullscreen({vrDisplay: vrDevice})
                    } else {
                        canvasContainer.requestFullscreen()
                    }
                },
                requestFullScreen: function (lockPointer, resizeCanvas, vrDevice) {
                    err("Browser.requestFullScreen() is deprecated. Please call Browser.requestFullscreen instead.");
                    Browser.requestFullScreen = function (lockPointer, resizeCanvas, vrDevice) {
                        return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
                    };
                    return Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
                },
                exitFullscreen: function () {
                    if (!Browser.isFullscreen) {
                        return false
                    }
                    var CFS = document["exitFullscreen"] || document["cancelFullScreen"] || document["mozCancelFullScreen"] || document["msExitFullscreen"] || document["webkitCancelFullScreen"] || function () {
                    };
                    CFS.apply(document, []);
                    return true
                },
                nextRAF: 0,
                fakeRequestAnimationFrame: function (func) {
                    var now = Date.now();
                    if (Browser.nextRAF === 0) {
                        Browser.nextRAF = now + 1e3 / 60
                    } else {
                        while (now + 2 >= Browser.nextRAF) {
                            Browser.nextRAF += 1e3 / 60
                        }
                    }
                    var delay = Math.max(Browser.nextRAF - now, 0);
                    setTimeout(func, delay)
                },
                requestAnimationFrame: function requestAnimationFrame(func) {
                    if (typeof window === "undefined") {
                        Browser.fakeRequestAnimationFrame(func)
                    } else {
                        if (!window.requestAnimationFrame) {
                            window.requestAnimationFrame = window["requestAnimationFrame"] || window["mozRequestAnimationFrame"] || window["webkitRequestAnimationFrame"] || window["msRequestAnimationFrame"] || window["oRequestAnimationFrame"] || Browser.fakeRequestAnimationFrame
                        }
                        window.requestAnimationFrame(func)
                    }
                },
                safeCallback: function (func) {
                    return function () {
                        if (!ABORT) return func.apply(null, arguments)
                    }
                },
                allowAsyncCallbacks: true,
                queuedAsyncCallbacks: [],
                pauseAsyncCallbacks: function () {
                    Browser.allowAsyncCallbacks = false
                },
                resumeAsyncCallbacks: function () {
                    Browser.allowAsyncCallbacks = true;
                    if (Browser.queuedAsyncCallbacks.length > 0) {
                        var callbacks = Browser.queuedAsyncCallbacks;
                        Browser.queuedAsyncCallbacks = [];
                        callbacks.forEach(function (func) {
                            func()
                        })
                    }
                },
                safeRequestAnimationFrame: function (func) {
                    return Browser.requestAnimationFrame(function () {
                        if (ABORT) return;
                        if (Browser.allowAsyncCallbacks) {
                            func()
                        } else {
                            Browser.queuedAsyncCallbacks.push(func)
                        }
                    })
                },
                safeSetTimeout: function (func, timeout) {
                    Module["noExitRuntime"] = true;
                    return setTimeout(function () {
                        if (ABORT) return;
                        if (Browser.allowAsyncCallbacks) {
                            func()
                        } else {
                            Browser.queuedAsyncCallbacks.push(func)
                        }
                    }, timeout)
                },
                safeSetInterval: function (func, timeout) {
                    Module["noExitRuntime"] = true;
                    return setInterval(function () {
                        if (ABORT) return;
                        if (Browser.allowAsyncCallbacks) {
                            func()
                        }
                    }, timeout)
                },
                getMimetype: function (name) {
                    return {
                        "jpg": "image/jpeg",
                        "jpeg": "image/jpeg",
                        "png": "image/png",
                        "bmp": "image/bmp",
                        "ogg": "audio/ogg",
                        "wav": "audio/wav",
                        "mp3": "audio/mpeg"
                    }[name.substr(name.lastIndexOf(".") + 1)]
                },
                getUserMedia: function (func) {
                    if (!window.getUserMedia) {
                        window.getUserMedia = navigator["getUserMedia"] || navigator["mozGetUserMedia"]
                    }
                    window.getUserMedia(func)
                },
                getMovementX: function (event) {
                    return event["movementX"] || event["mozMovementX"] || event["webkitMovementX"] || 0
                },
                getMovementY: function (event) {
                    return event["movementY"] || event["mozMovementY"] || event["webkitMovementY"] || 0
                },
                getMouseWheelDelta: function (event) {
                    var delta = 0;
                    switch (event.type) {
                        case"DOMMouseScroll":
                            delta = event.detail / 3;
                            break;
                        case"mousewheel":
                            delta = event.wheelDelta / 120;
                            break;
                        case"wheel":
                            delta = event.deltaY;
                            switch (event.deltaMode) {
                                case 0:
                                    delta /= 100;
                                    break;
                                case 1:
                                    delta /= 3;
                                    break;
                                case 2:
                                    delta *= 80;
                                    break;
                                default:
                                    throw"unrecognized mouse wheel delta mode: " + event.deltaMode
                            }
                            break;
                        default:
                            throw"unrecognized mouse wheel event: " + event.type
                    }
                    return delta
                },
                mouseX: 0,
                mouseY: 0,
                mouseMovementX: 0,
                mouseMovementY: 0,
                touches: {},
                lastTouches: {},
                calculateMouseEvent: function (event) {
                    if (Browser.pointerLock) {
                        if (event.type != "mousemove" && "mozMovementX" in event) {
                            Browser.mouseMovementX = Browser.mouseMovementY = 0
                        } else {
                            Browser.mouseMovementX = Browser.getMovementX(event);
                            Browser.mouseMovementY = Browser.getMovementY(event)
                        }
                        if (typeof SDL != "undefined") {
                            Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
                            Browser.mouseY = SDL.mouseY + Browser.mouseMovementY
                        } else {
                            Browser.mouseX += Browser.mouseMovementX;
                            Browser.mouseY += Browser.mouseMovementY
                        }
                    } else {
                        var rect = Module["canvas"].getBoundingClientRect();
                        var cw = Module["canvas"].width;
                        var ch = Module["canvas"].height;
                        var scrollX = typeof window.scrollX !== "undefined" ? window.scrollX : window.pageXOffset;
                        var scrollY = typeof window.scrollY !== "undefined" ? window.scrollY : window.pageYOffset;
                        if (event.type === "touchstart" || event.type === "touchend" || event.type === "touchmove") {
                            var touch = event.touch;
                            if (touch === undefined) {
                                return
                            }
                            var adjustedX = touch.pageX - (scrollX + rect.left);
                            var adjustedY = touch.pageY - (scrollY + rect.top);
                            adjustedX = adjustedX * (cw / rect.width);
                            adjustedY = adjustedY * (ch / rect.height);
                            var coords = {x: adjustedX, y: adjustedY};
                            if (event.type === "touchstart") {
                                Browser.lastTouches[touch.identifier] = coords;
                                Browser.touches[touch.identifier] = coords
                            } else if (event.type === "touchend" || event.type === "touchmove") {
                                var last = Browser.touches[touch.identifier];
                                if (!last) last = coords;
                                Browser.lastTouches[touch.identifier] = last;
                                Browser.touches[touch.identifier] = coords
                            }
                            return
                        }
                        var x = event.pageX - (scrollX + rect.left);
                        var y = event.pageY - (scrollY + rect.top);
                        x = x * (cw / rect.width);
                        y = y * (ch / rect.height);
                        Browser.mouseMovementX = x - Browser.mouseX;
                        Browser.mouseMovementY = y - Browser.mouseY;
                        Browser.mouseX = x;
                        Browser.mouseY = y
                    }
                },
                asyncLoad: function (url, onload, onerror, noRunDep) {
                    var dep = !noRunDep ? getUniqueRunDependency("al " + url) : "";
                    Module["readAsync"](url, function (arrayBuffer) {
                        assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
                        onload(new Uint8Array(arrayBuffer));
                        if (dep) removeRunDependency(dep)
                    }, function (event) {
                        if (onerror) {
                            onerror()
                        } else {
                            throw'Loading data file "' + url + '" failed.'
                        }
                    });
                    if (dep) addRunDependency(dep)
                },
                resizeListeners: [],
                updateResizeListeners: function () {
                    var canvas = Module["canvas"];
                    Browser.resizeListeners.forEach(function (listener) {
                        listener(canvas.width, canvas.height)
                    })
                },
                setCanvasSize: function (width, height, noUpdates) {
                    var canvas = Module["canvas"];
                    Browser.updateCanvasDimensions(canvas, width, height);
                    if (!noUpdates) Browser.updateResizeListeners()
                },
                windowedWidth: 0,
                windowedHeight: 0,
                setFullscreenCanvasSize: function () {
                    if (typeof SDL != "undefined") {
                        var flags = HEAPU32[SDL.screen >> 2];
                        flags = flags | 8388608;
                        HEAP32[SDL.screen >> 2] = flags
                    }
                    Browser.updateCanvasDimensions(Module["canvas"]);
                    Browser.updateResizeListeners()
                },
                setWindowedCanvasSize: function () {
                    if (typeof SDL != "undefined") {
                        var flags = HEAPU32[SDL.screen >> 2];
                        flags = flags & ~8388608;
                        HEAP32[SDL.screen >> 2] = flags
                    }
                    Browser.updateCanvasDimensions(Module["canvas"]);
                    Browser.updateResizeListeners()
                },
                updateCanvasDimensions: function (canvas, wNative, hNative) {
                    if (wNative && hNative) {
                        canvas.widthNative = wNative;
                        canvas.heightNative = hNative
                    } else {
                        wNative = canvas.widthNative;
                        hNative = canvas.heightNative
                    }
                    var w = wNative;
                    var h = hNative;
                    if (Module["forcedAspectRatio"] && Module["forcedAspectRatio"] > 0) {
                        if (w / h < Module["forcedAspectRatio"]) {
                            w = Math.round(h * Module["forcedAspectRatio"])
                        } else {
                            h = Math.round(w / Module["forcedAspectRatio"])
                        }
                    }
                    if ((document["fullscreenElement"] || document["mozFullScreenElement"] || document["msFullscreenElement"] || document["webkitFullscreenElement"] || document["webkitCurrentFullScreenElement"]) === canvas.parentNode && typeof screen != "undefined") {
                        var factor = Math.min(screen.width / w, screen.height / h);
                        w = Math.round(w * factor);
                        h = Math.round(h * factor)
                    }
                    if (Browser.resizeCanvas) {
                        if (canvas.width != w) canvas.width = w;
                        if (canvas.height != h) canvas.height = h;
                        if (typeof canvas.style != "undefined") {
                            canvas.style.removeProperty("width");
                            canvas.style.removeProperty("height")
                        }
                    } else {
                        if (canvas.width != wNative) canvas.width = wNative;
                        if (canvas.height != hNative) canvas.height = hNative;
                        if (typeof canvas.style != "undefined") {
                            if (w != wNative || h != hNative) {
                                canvas.style.setProperty("width", w + "px", "important");
                                canvas.style.setProperty("height", h + "px", "important")
                            } else {
                                canvas.style.removeProperty("width");
                                canvas.style.removeProperty("height")
                            }
                        }
                    }
                },
                wgetRequests: {},
                nextWgetRequestHandle: 0,
                getNextWgetRequestHandle: function () {
                    var handle = Browser.nextWgetRequestHandle;
                    Browser.nextWgetRequestHandle++;
                    return handle
                }
            };
            var EmterpreterAsync = {
                initted: false,
                state: 0,
                saveStack: "",
                yieldCallbacks: [],
                postAsync: null,
                restartFunc: null,
                asyncFinalizers: [],
                ensureInit: function () {
                    if (this.initted) return;
                    this.initted = true
                },
                setState: function (s) {
                    this.ensureInit();
                    this.state = s;
                    Module["setAsyncState"](s)
                },
                handle: function (doAsyncOp, yieldDuring) {
                    Module["noExitRuntime"] = true;
                    if (EmterpreterAsync.state === 0) {
                        var stack = new Int32Array(HEAP32.subarray(EMTSTACKTOP >> 2, Module["emtStackSave"]() >> 2));
                        var resumedCallbacksForYield = false;

                        function resumeCallbacksForYield() {
                            if (resumedCallbacksForYield) return;
                            resumedCallbacksForYield = true;
                            EmterpreterAsync.yieldCallbacks.forEach(function (func) {
                                func()
                            });
                            Browser.resumeAsyncCallbacks()
                        }

                        var callingDoAsyncOp = 1;
                        doAsyncOp(function resume(post) {
                            if (ABORT) {
                                return
                            }
                            if (callingDoAsyncOp) {
                                assert(callingDoAsyncOp === 1);
                                callingDoAsyncOp++;
                                setTimeout(function () {
                                    resume(post)
                                }, 0);
                                return
                            }
                            assert(EmterpreterAsync.state === 1 || EmterpreterAsync.state === 3);
                            EmterpreterAsync.setState(3);
                            if (yieldDuring) {
                                resumeCallbacksForYield()
                            }
                            HEAP32.set(stack, EMTSTACKTOP >> 2);
                            EmterpreterAsync.setState(2);
                            if (Browser.mainLoop.func) {
                                Browser.mainLoop.resume()
                            }
                            assert(!EmterpreterAsync.postAsync);
                            EmterpreterAsync.postAsync = post || null;
                            var asyncReturnValue;
                            if (!EmterpreterAsync.restartFunc) {
                                Module["emterpret"](stack[0])
                            } else {
                                asyncReturnValue = EmterpreterAsync.restartFunc()
                            }
                            if (!yieldDuring && EmterpreterAsync.state === 0) {
                                Browser.resumeAsyncCallbacks()
                            }
                            if (EmterpreterAsync.state === 0) {
                                EmterpreterAsync.restartFunc = null;
                                var asyncFinalizers = EmterpreterAsync.asyncFinalizers;
                                EmterpreterAsync.asyncFinalizers = [];
                                asyncFinalizers.forEach(function (func) {
                                    func(asyncReturnValue)
                                })
                            }
                        });
                        callingDoAsyncOp = 0;
                        EmterpreterAsync.setState(1);
                        if (Browser.mainLoop.func) {
                            Browser.mainLoop.pause()
                        }
                        if (yieldDuring) {
                            setTimeout(function () {
                                resumeCallbacksForYield()
                            }, 0)
                        } else {
                            Browser.pauseAsyncCallbacks()
                        }
                    } else {
                        assert(EmterpreterAsync.state === 2);
                        EmterpreterAsync.setState(0);
                        if (EmterpreterAsync.postAsync) {
                            var ret = EmterpreterAsync.postAsync();
                            EmterpreterAsync.postAsync = null;
                            return ret
                        }
                    }
                }
            };

            function _emscripten_binary_read(buf, size) {
                return EmterpreterAsync.handle(function (resume) {
                    Module["stdinAsync"](size, function (data) {
                        var finalSize = Math.min(size, data.length);
                        Module["HEAPU8"].set(data.subarray(0, finalSize), buf);
                        resume(function () {
                            return finalSize
                        })
                    })
                })
            }

            function _emscripten_binary_write(buf, size) {
                Module["stdoutBinary"](Module["HEAPU8"].subarray(buf, buf + size));
                return size
            }

            function _emscripten_get_heap_size() {
                return HEAP8.length
            }

            function abortOnCannotGrowMemory(requestedSize) {
                abort("OOM")
            }

            function emscripten_realloc_buffer(size) {
                var PAGE_MULTIPLE = 65536;
                size = alignUp(size, PAGE_MULTIPLE);
                var oldSize = buffer.byteLength;
                try {
                    var result = wasmMemory.grow((size - oldSize) / 65536);
                    if (result !== (-1 | 0)) {
                        return buffer = wasmMemory.buffer
                    } else {
                        return null
                    }
                } catch (e) {
                    return null
                }
            }

            function _emscripten_resize_heap(requestedSize) {
                var oldSize = _emscripten_get_heap_size();
                var PAGE_MULTIPLE = 65536;
                var LIMIT = 2147483648 - PAGE_MULTIPLE;
                if (requestedSize > LIMIT) {
                    return false
                }
                var MIN_TOTAL_MEMORY = 16777216;
                var newSize = Math.max(oldSize, MIN_TOTAL_MEMORY);
                while (newSize < requestedSize) {
                    if (newSize <= 536870912) {
                        newSize = alignUp(2 * newSize, PAGE_MULTIPLE)
                    } else {
                        newSize = Math.min(alignUp((3 * newSize + 2147483648) / 4, PAGE_MULTIPLE), LIMIT)
                    }
                }
                var replacement = emscripten_realloc_buffer(newSize);
                if (!replacement || replacement.byteLength != newSize) {
                    return false
                }
                updateGlobalBufferViews();
                return true
            }

            function _exit(status) {
                exit(status)
            }

            var _fabs = Math_abs;

            function _getenv(name) {
                if (name === 0) return 0;
                name = UTF8ToString(name);
                if (!ENV.hasOwnProperty(name)) return 0;
                if (_getenv.ret) _free(_getenv.ret);
                _getenv.ret = allocateUTF8(ENV[name]);
                return _getenv.ret
            }

            function _gettimeofday(ptr) {
                var now = Date.now();
                HEAP32[ptr >> 2] = now / 1e3 | 0;
                HEAP32[ptr + 4 >> 2] = now % 1e3 * 1e3 | 0;
                return 0
            }

            var ___tm_current = 4310352;
            var ___tm_timezone = (stringToUTF8("GMT", 4310400, 4), 4310400);

            function _gmtime_r(time, tmPtr) {
                var date = new Date(HEAP32[time >> 2] * 1e3);
                HEAP32[tmPtr >> 2] = date.getUTCSeconds();
                HEAP32[tmPtr + 4 >> 2] = date.getUTCMinutes();
                HEAP32[tmPtr + 8 >> 2] = date.getUTCHours();
                HEAP32[tmPtr + 12 >> 2] = date.getUTCDate();
                HEAP32[tmPtr + 16 >> 2] = date.getUTCMonth();
                HEAP32[tmPtr + 20 >> 2] = date.getUTCFullYear() - 1900;
                HEAP32[tmPtr + 24 >> 2] = date.getUTCDay();
                HEAP32[tmPtr + 36 >> 2] = 0;
                HEAP32[tmPtr + 32 >> 2] = 0;
                var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
                var yday = (date.getTime() - start) / (1e3 * 60 * 60 * 24) | 0;
                HEAP32[tmPtr + 28 >> 2] = yday;
                HEAP32[tmPtr + 40 >> 2] = ___tm_timezone;
                return tmPtr
            }

            function _gmtime(time) {
                return _gmtime_r(time, ___tm_current)
            }

            function _llvm_exp2_f32(x) {
                return Math.pow(2, x)
            }

            function _llvm_exp2_f64(a0) {
                return _llvm_exp2_f32(a0)
            }

            function _llvm_log10_f32(x) {
                return Math.log(x) / Math.LN10
            }

            function _llvm_log10_f64(a0) {
                return _llvm_log10_f32(a0)
            }

            function _llvm_log2_f32(x) {
                return Math.log(x) / Math.LN2
            }

            function _llvm_log2_f64(a0) {
                return _llvm_log2_f32(a0)
            }

            var _llvm_trunc_f64 = Math_trunc;

            function _tzset() {
                if (_tzset.called) return;
                _tzset.called = true;
                HEAP32[__get_timezone() >> 2] = (new Date).getTimezoneOffset() * 60;
                var winter = new Date(2e3, 0, 1);
                var summer = new Date(2e3, 6, 1);
                HEAP32[__get_daylight() >> 2] = Number(winter.getTimezoneOffset() != summer.getTimezoneOffset());

                function extractZone(date) {
                    var match = date.toTimeString().match(/\(([A-Za-z ]+)\)$/);
                    return match ? match[1] : "GMT"
                }

                var winterName = extractZone(winter);
                var summerName = extractZone(summer);
                var winterNamePtr = allocate(intArrayFromString(winterName), "i8", ALLOC_NORMAL);
                var summerNamePtr = allocate(intArrayFromString(summerName), "i8", ALLOC_NORMAL);
                if (summer.getTimezoneOffset() < winter.getTimezoneOffset()) {
                    HEAP32[__get_tzname() >> 2] = winterNamePtr;
                    HEAP32[__get_tzname() + 4 >> 2] = summerNamePtr
                } else {
                    HEAP32[__get_tzname() >> 2] = summerNamePtr;
                    HEAP32[__get_tzname() + 4 >> 2] = winterNamePtr
                }
            }

            function _localtime_r(time, tmPtr) {
                _tzset();
                var date = new Date(HEAP32[time >> 2] * 1e3);
                HEAP32[tmPtr >> 2] = date.getSeconds();
                HEAP32[tmPtr + 4 >> 2] = date.getMinutes();
                HEAP32[tmPtr + 8 >> 2] = date.getHours();
                HEAP32[tmPtr + 12 >> 2] = date.getDate();
                HEAP32[tmPtr + 16 >> 2] = date.getMonth();
                HEAP32[tmPtr + 20 >> 2] = date.getFullYear() - 1900;
                HEAP32[tmPtr + 24 >> 2] = date.getDay();
                var start = new Date(date.getFullYear(), 0, 1);
                var yday = (date.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24) | 0;
                HEAP32[tmPtr + 28 >> 2] = yday;
                HEAP32[tmPtr + 36 >> 2] = -(date.getTimezoneOffset() * 60);
                var summerOffset = new Date(2e3, 6, 1).getTimezoneOffset();
                var winterOffset = start.getTimezoneOffset();
                var dst = (summerOffset != winterOffset && date.getTimezoneOffset() == Math.min(winterOffset, summerOffset)) | 0;
                HEAP32[tmPtr + 32 >> 2] = dst;
                var zonePtr = HEAP32[__get_tzname() + (dst ? 4 : 0) >> 2];
                HEAP32[tmPtr + 40 >> 2] = zonePtr;
                return tmPtr
            }

            function _localtime(time) {
                return _localtime_r(time, ___tm_current)
            }

            function _emscripten_memcpy_big(dest, src, num) {
                HEAPU8.set(HEAPU8.subarray(src, src + num), dest)
            }

            function _mktime(tmPtr) {
                _tzset();
                var date = new Date(HEAP32[tmPtr + 20 >> 2] + 1900, HEAP32[tmPtr + 16 >> 2], HEAP32[tmPtr + 12 >> 2], HEAP32[tmPtr + 8 >> 2], HEAP32[tmPtr + 4 >> 2], HEAP32[tmPtr >> 2], 0);
                var dst = HEAP32[tmPtr + 32 >> 2];
                var guessedOffset = date.getTimezoneOffset();
                var start = new Date(date.getFullYear(), 0, 1);
                var summerOffset = new Date(2e3, 6, 1).getTimezoneOffset();
                var winterOffset = start.getTimezoneOffset();
                var dstOffset = Math.min(winterOffset, summerOffset);
                if (dst < 0) {
                    HEAP32[tmPtr + 32 >> 2] = Number(summerOffset != winterOffset && dstOffset == guessedOffset)
                } else if (dst > 0 != (dstOffset == guessedOffset)) {
                    var nonDstOffset = Math.max(winterOffset, summerOffset);
                    var trueOffset = dst > 0 ? dstOffset : nonDstOffset;
                    date.setTime(date.getTime() + (trueOffset - guessedOffset) * 6e4)
                }
                HEAP32[tmPtr + 24 >> 2] = date.getDay();
                var yday = (date.getTime() - start.getTime()) / (1e3 * 60 * 60 * 24) | 0;
                HEAP32[tmPtr + 28 >> 2] = yday;
                return date.getTime() / 1e3 | 0
            }

            function _usleep(useconds) {
                var msec = useconds / 1e3;
                if ((ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) && self["performance"] && self["performance"]["now"]) {
                    var start = self["performance"]["now"]();
                    while (self["performance"]["now"]() - start < msec) {
                    }
                } else {
                    var start = Date.now();
                    while (Date.now() - start < msec) {
                    }
                }
                return 0
            }

            function _nanosleep(rqtp, rmtp) {
                var seconds = HEAP32[rqtp >> 2];
                var nanoseconds = HEAP32[rqtp + 4 >> 2];
                if (rmtp !== 0) {
                    HEAP32[rmtp >> 2] = 0;
                    HEAP32[rmtp + 4 >> 2] = 0
                }
                return _usleep(seconds * 1e6 + nanoseconds / 1e3)
            }

            var __sigalrm_handler = 0;

            function _signal(sig, func) {
                if (sig == 14) {
                    __sigalrm_handler = func
                } else {
                }
                return 0
            }

            function __isLeapYear(year) {
                return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
            }

            function __arraySum(array, index) {
                var sum = 0;
                for (var i = 0; i <= index; sum += array[i++]) ;
                return sum
            }

            var __MONTH_DAYS_LEAP = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            var __MONTH_DAYS_REGULAR = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

            function __addDays(date, days) {
                var newDate = new Date(date.getTime());
                while (days > 0) {
                    var leap = __isLeapYear(newDate.getFullYear());
                    var currentMonth = newDate.getMonth();
                    var daysInCurrentMonth = (leap ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR)[currentMonth];
                    if (days > daysInCurrentMonth - newDate.getDate()) {
                        days -= daysInCurrentMonth - newDate.getDate() + 1;
                        newDate.setDate(1);
                        if (currentMonth < 11) {
                            newDate.setMonth(currentMonth + 1)
                        } else {
                            newDate.setMonth(0);
                            newDate.setFullYear(newDate.getFullYear() + 1)
                        }
                    } else {
                        newDate.setDate(newDate.getDate() + days);
                        return newDate
                    }
                }
                return newDate
            }

            function _strftime(s, maxsize, format, tm) {
                var tm_zone = HEAP32[tm + 40 >> 2];
                var date = {
                    tm_sec: HEAP32[tm >> 2],
                    tm_min: HEAP32[tm + 4 >> 2],
                    tm_hour: HEAP32[tm + 8 >> 2],
                    tm_mday: HEAP32[tm + 12 >> 2],
                    tm_mon: HEAP32[tm + 16 >> 2],
                    tm_year: HEAP32[tm + 20 >> 2],
                    tm_wday: HEAP32[tm + 24 >> 2],
                    tm_yday: HEAP32[tm + 28 >> 2],
                    tm_isdst: HEAP32[tm + 32 >> 2],
                    tm_gmtoff: HEAP32[tm + 36 >> 2],
                    tm_zone: tm_zone ? UTF8ToString(tm_zone) : ""
                };
                var pattern = UTF8ToString(format);
                var EXPANSION_RULES_1 = {
                    "%c": "%a %b %d %H:%M:%S %Y",
                    "%D": "%m/%d/%y",
                    "%F": "%Y-%m-%d",
                    "%h": "%b",
                    "%r": "%I:%M:%S %p",
                    "%R": "%H:%M",
                    "%T": "%H:%M:%S",
                    "%x": "%m/%d/%y",
                    "%X": "%H:%M:%S"
                };
                for (var rule in EXPANSION_RULES_1) {
                    pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_1[rule])
                }
                var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

                function leadingSomething(value, digits, character) {
                    var str = typeof value === "number" ? value.toString() : value || "";
                    while (str.length < digits) {
                        str = character[0] + str
                    }
                    return str
                }

                function leadingNulls(value, digits) {
                    return leadingSomething(value, digits, "0")
                }

                function compareByDay(date1, date2) {
                    function sgn(value) {
                        return value < 0 ? -1 : value > 0 ? 1 : 0
                    }

                    var compare;
                    if ((compare = sgn(date1.getFullYear() - date2.getFullYear())) === 0) {
                        if ((compare = sgn(date1.getMonth() - date2.getMonth())) === 0) {
                            compare = sgn(date1.getDate() - date2.getDate())
                        }
                    }
                    return compare
                }

                function getFirstWeekStartDate(janFourth) {
                    switch (janFourth.getDay()) {
                        case 0:
                            return new Date(janFourth.getFullYear() - 1, 11, 29);
                        case 1:
                            return janFourth;
                        case 2:
                            return new Date(janFourth.getFullYear(), 0, 3);
                        case 3:
                            return new Date(janFourth.getFullYear(), 0, 2);
                        case 4:
                            return new Date(janFourth.getFullYear(), 0, 1);
                        case 5:
                            return new Date(janFourth.getFullYear() - 1, 11, 31);
                        case 6:
                            return new Date(janFourth.getFullYear() - 1, 11, 30)
                    }
                }

                function getWeekBasedYear(date) {
                    var thisDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
                    var janFourthThisYear = new Date(thisDate.getFullYear(), 0, 4);
                    var janFourthNextYear = new Date(thisDate.getFullYear() + 1, 0, 4);
                    var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
                    var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
                    if (compareByDay(firstWeekStartThisYear, thisDate) <= 0) {
                        if (compareByDay(firstWeekStartNextYear, thisDate) <= 0) {
                            return thisDate.getFullYear() + 1
                        } else {
                            return thisDate.getFullYear()
                        }
                    } else {
                        return thisDate.getFullYear() - 1
                    }
                }

                var EXPANSION_RULES_2 = {
                    "%a": function (date) {
                        return WEEKDAYS[date.tm_wday].substring(0, 3)
                    }, "%A": function (date) {
                        return WEEKDAYS[date.tm_wday]
                    }, "%b": function (date) {
                        return MONTHS[date.tm_mon].substring(0, 3)
                    }, "%B": function (date) {
                        return MONTHS[date.tm_mon]
                    }, "%C": function (date) {
                        var year = date.tm_year + 1900;
                        return leadingNulls(year / 100 | 0, 2)
                    }, "%d": function (date) {
                        return leadingNulls(date.tm_mday, 2)
                    }, "%e": function (date) {
                        return leadingSomething(date.tm_mday, 2, " ")
                    }, "%g": function (date) {
                        return getWeekBasedYear(date).toString().substring(2)
                    }, "%G": function (date) {
                        return getWeekBasedYear(date)
                    }, "%H": function (date) {
                        return leadingNulls(date.tm_hour, 2)
                    }, "%I": function (date) {
                        var twelveHour = date.tm_hour;
                        if (twelveHour == 0) twelveHour = 12; else if (twelveHour > 12) twelveHour -= 12;
                        return leadingNulls(twelveHour, 2)
                    }, "%j": function (date) {
                        return leadingNulls(date.tm_mday + __arraySum(__isLeapYear(date.tm_year + 1900) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, date.tm_mon - 1), 3)
                    }, "%m": function (date) {
                        return leadingNulls(date.tm_mon + 1, 2)
                    }, "%M": function (date) {
                        return leadingNulls(date.tm_min, 2)
                    }, "%n": function () {
                        return "\n"
                    }, "%p": function (date) {
                        if (date.tm_hour >= 0 && date.tm_hour < 12) {
                            return "AM"
                        } else {
                            return "PM"
                        }
                    }, "%S": function (date) {
                        return leadingNulls(date.tm_sec, 2)
                    }, "%t": function () {
                        return "\t"
                    }, "%u": function (date) {
                        var day = new Date(date.tm_year + 1900, date.tm_mon + 1, date.tm_mday, 0, 0, 0, 0);
                        return day.getDay() || 7
                    }, "%U": function (date) {
                        var janFirst = new Date(date.tm_year + 1900, 0, 1);
                        var firstSunday = janFirst.getDay() === 0 ? janFirst : __addDays(janFirst, 7 - janFirst.getDay());
                        var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
                        if (compareByDay(firstSunday, endDate) < 0) {
                            var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
                            var firstSundayUntilEndJanuary = 31 - firstSunday.getDate();
                            var days = firstSundayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
                            return leadingNulls(Math.ceil(days / 7), 2)
                        }
                        return compareByDay(firstSunday, janFirst) === 0 ? "01" : "00"
                    }, "%V": function (date) {
                        var janFourthThisYear = new Date(date.tm_year + 1900, 0, 4);
                        var janFourthNextYear = new Date(date.tm_year + 1901, 0, 4);
                        var firstWeekStartThisYear = getFirstWeekStartDate(janFourthThisYear);
                        var firstWeekStartNextYear = getFirstWeekStartDate(janFourthNextYear);
                        var endDate = __addDays(new Date(date.tm_year + 1900, 0, 1), date.tm_yday);
                        if (compareByDay(endDate, firstWeekStartThisYear) < 0) {
                            return "53"
                        }
                        if (compareByDay(firstWeekStartNextYear, endDate) <= 0) {
                            return "01"
                        }
                        var daysDifference;
                        if (firstWeekStartThisYear.getFullYear() < date.tm_year + 1900) {
                            daysDifference = date.tm_yday + 32 - firstWeekStartThisYear.getDate()
                        } else {
                            daysDifference = date.tm_yday + 1 - firstWeekStartThisYear.getDate()
                        }
                        return leadingNulls(Math.ceil(daysDifference / 7), 2)
                    }, "%w": function (date) {
                        var day = new Date(date.tm_year + 1900, date.tm_mon + 1, date.tm_mday, 0, 0, 0, 0);
                        return day.getDay()
                    }, "%W": function (date) {
                        var janFirst = new Date(date.tm_year, 0, 1);
                        var firstMonday = janFirst.getDay() === 1 ? janFirst : __addDays(janFirst, janFirst.getDay() === 0 ? 1 : 7 - janFirst.getDay() + 1);
                        var endDate = new Date(date.tm_year + 1900, date.tm_mon, date.tm_mday);
                        if (compareByDay(firstMonday, endDate) < 0) {
                            var februaryFirstUntilEndMonth = __arraySum(__isLeapYear(endDate.getFullYear()) ? __MONTH_DAYS_LEAP : __MONTH_DAYS_REGULAR, endDate.getMonth() - 1) - 31;
                            var firstMondayUntilEndJanuary = 31 - firstMonday.getDate();
                            var days = firstMondayUntilEndJanuary + februaryFirstUntilEndMonth + endDate.getDate();
                            return leadingNulls(Math.ceil(days / 7), 2)
                        }
                        return compareByDay(firstMonday, janFirst) === 0 ? "01" : "00"
                    }, "%y": function (date) {
                        return (date.tm_year + 1900).toString().substring(2)
                    }, "%Y": function (date) {
                        return date.tm_year + 1900
                    }, "%z": function (date) {
                        var off = date.tm_gmtoff;
                        var ahead = off >= 0;
                        off = Math.abs(off) / 60;
                        off = off / 60 * 100 + off % 60;
                        return (ahead ? "+" : "-") + String("0000" + off).slice(-4)
                    }, "%Z": function (date) {
                        return date.tm_zone
                    }, "%%": function () {
                        return "%"
                    }
                };
                for (var rule in EXPANSION_RULES_2) {
                    if (pattern.indexOf(rule) >= 0) {
                        pattern = pattern.replace(new RegExp(rule, "g"), EXPANSION_RULES_2[rule](date))
                    }
                }
                var bytes = intArrayFromString(pattern, false);
                if (bytes.length > maxsize) {
                    return 0
                }
                writeArrayToMemory(bytes, s);
                return bytes.length - 1
            }

            function _time(ptr) {
                var ret = Date.now() / 1e3 | 0;
                if (ptr) {
                    HEAP32[ptr >> 2] = ret
                }
                return ret
            }

            FS.staticInit();
            if (ENVIRONMENT_IS_NODE) {
                var fs = require("fs");
                var NODEJS_PATH = require("path");
                NODEFS.staticInit()
            }
            if (ENVIRONMENT_IS_NODE) {
                _emscripten_get_now = function _emscripten_get_now_actual() {
                    var t = process["hrtime"]();
                    return t[0] * 1e3 + t[1] / 1e6
                }
            } else if (typeof dateNow !== "undefined") {
                _emscripten_get_now = dateNow
            } else if (typeof performance === "object" && performance && typeof performance["now"] === "function") {
                _emscripten_get_now = function () {
                    return performance["now"]()
                }
            } else {
                _emscripten_get_now = Date.now
            }
            Module["requestFullScreen"] = function Module_requestFullScreen(lockPointer, resizeCanvas, vrDevice) {
                err("Module.requestFullScreen is deprecated. Please call Module.requestFullscreen instead.");
                Module["requestFullScreen"] = Module["requestFullscreen"];
                Browser.requestFullScreen(lockPointer, resizeCanvas, vrDevice)
            };
            Module["requestFullscreen"] = function Module_requestFullscreen(lockPointer, resizeCanvas, vrDevice) {
                Browser.requestFullscreen(lockPointer, resizeCanvas, vrDevice)
            };
            Module["requestAnimationFrame"] = function Module_requestAnimationFrame(func) {
                Browser.requestAnimationFrame(func)
            };
            Module["setCanvasSize"] = function Module_setCanvasSize(width, height, noUpdates) {
                Browser.setCanvasSize(width, height, noUpdates)
            };
            Module["pauseMainLoop"] = function Module_pauseMainLoop() {
                Browser.mainLoop.pause()
            };
            Module["resumeMainLoop"] = function Module_resumeMainLoop() {
                Browser.mainLoop.resume()
            };
            Module["getUserMedia"] = function Module_getUserMedia() {
                Browser.getUserMedia()
            };
            Module["createContext"] = function Module_createContext(canvas, useWebGL, setInModule, webGLContextAttributes) {
                return Browser.createContext(canvas, useWebGL, setInModule, webGLContextAttributes)
            };
            var ASSERTIONS = false;

            function intArrayFromString(stringy, dontAddNull, length) {
                var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
                var u8array = new Array(len);
                var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
                if (dontAddNull) u8array.length = numBytesWritten;
                return u8array
            }

            var asmGlobalArg = {};
            var asmLibraryArg = {
                "abort": abort,
                "setTempRet0": setTempRet0,
                "getTempRet0": getTempRet0,
                "abortStackOverflowEmterpreter": abortStackOverflowEmterpreter,
                "___assert_fail": ___assert_fail,
                "___buildEnvironment": ___buildEnvironment,
                "___lock": ___lock,
                "___setErrNo": ___setErrNo,
                "___syscall10": ___syscall10,
                "___syscall140": ___syscall140,
                "___syscall142": ___syscall142,
                "___syscall145": ___syscall145,
                "___syscall146": ___syscall146,
                "___syscall195": ___syscall195,
                "___syscall196": ___syscall196,
                "___syscall197": ___syscall197,
                "___syscall219": ___syscall219,
                "___syscall220": ___syscall220,
                "___syscall221": ___syscall221,
                "___syscall3": ___syscall3,
                "___syscall33": ___syscall33,
                "___syscall340": ___syscall340,
                "___syscall38": ___syscall38,
                "___syscall4": ___syscall4,
                "___syscall40": ___syscall40,
                "___syscall5": ___syscall5,
                "___syscall54": ___syscall54,
                "___syscall6": ___syscall6,
                "___syscall75": ___syscall75,
                "___syscall77": ___syscall77,
                "___unlock": ___unlock,
                "__addDays": __addDays,
                "__arraySum": __arraySum,
                "__isLeapYear": __isLeapYear,
                "_abort": _abort,
                "_clock": _clock,
                "_clock_gettime": _clock_gettime,
                "_emscripten_binary_read": _emscripten_binary_read,
                "_emscripten_binary_write": _emscripten_binary_write,
                "_emscripten_get_heap_size": _emscripten_get_heap_size,
                "_emscripten_get_now": _emscripten_get_now,
                "_emscripten_get_now_is_monotonic": _emscripten_get_now_is_monotonic,
                "_emscripten_memcpy_big": _emscripten_memcpy_big,
                "_emscripten_resize_heap": _emscripten_resize_heap,
                "_emscripten_set_main_loop": _emscripten_set_main_loop,
                "_emscripten_set_main_loop_timing": _emscripten_set_main_loop_timing,
                "_exit": _exit,
                "_fabs": _fabs,
                "_getenv": _getenv,
                "_gettimeofday": _gettimeofday,
                "_gmtime": _gmtime,
                "_gmtime_r": _gmtime_r,
                "_llvm_cttz_i32": _llvm_cttz_i32,
                "_llvm_exp2_f32": _llvm_exp2_f32,
                "_llvm_exp2_f64": _llvm_exp2_f64,
                "_llvm_log10_f32": _llvm_log10_f32,
                "_llvm_log10_f64": _llvm_log10_f64,
                "_llvm_log2_f32": _llvm_log2_f32,
                "_llvm_log2_f64": _llvm_log2_f64,
                "_llvm_trunc_f64": _llvm_trunc_f64,
                "_localtime": _localtime,
                "_localtime_r": _localtime_r,
                "_mktime": _mktime,
                "_nanosleep": _nanosleep,
                "_signal": _signal,
                "_strftime": _strftime,
                "_time": _time,
                "_tzset": _tzset,
                "_usleep": _usleep,
                "abortOnCannotGrowMemory": abortOnCannotGrowMemory,
                "emscripten_realloc_buffer": emscripten_realloc_buffer,
                "tempDoublePtr": tempDoublePtr,
                "DYNAMICTOP_PTR": DYNAMICTOP_PTR,
                "EMTSTACKTOP": EMTSTACKTOP,
                "EMT_STACK_MAX": EMT_STACK_MAX,
                "eb": eb
            };
            var asm = Module["asm"](asmGlobalArg, asmLibraryArg, buffer);
            Module["asm"] = asm;
            var ___divdi3 = Module["___divdi3"] = function () {
                return Module["asm"]["___divdi3"].apply(null, arguments)
            };
            var ___emscripten_environ_constructor = Module["___emscripten_environ_constructor"] = function () {
                return Module["asm"]["___emscripten_environ_constructor"].apply(null, arguments)
            };
            var ___errno_location = Module["___errno_location"] = function () {
                return Module["asm"]["___errno_location"].apply(null, arguments)
            };
            var ___muldi3 = Module["___muldi3"] = function () {
                return Module["asm"]["___muldi3"].apply(null, arguments)
            };
            var ___remdi3 = Module["___remdi3"] = function () {
                return Module["asm"]["___remdi3"].apply(null, arguments)
            };
            var ___udivdi3 = Module["___udivdi3"] = function () {
                return Module["asm"]["___udivdi3"].apply(null, arguments)
            };
            var ___uremdi3 = Module["___uremdi3"] = function () {
                return Module["asm"]["___uremdi3"].apply(null, arguments)
            };
            var __get_daylight = Module["__get_daylight"] = function () {
                return Module["asm"]["__get_daylight"].apply(null, arguments)
            };
            var __get_environ = Module["__get_environ"] = function () {
                return Module["asm"]["__get_environ"].apply(null, arguments)
            };
            var __get_timezone = Module["__get_timezone"] = function () {
                return Module["asm"]["__get_timezone"].apply(null, arguments)
            };
            var __get_tzname = Module["__get_tzname"] = function () {
                return Module["asm"]["__get_tzname"].apply(null, arguments)
            };
            var _bitshift64Ashr = Module["_bitshift64Ashr"] = function () {
                return Module["asm"]["_bitshift64Ashr"].apply(null, arguments)
            };
            var _bitshift64Lshr = Module["_bitshift64Lshr"] = function () {
                return Module["asm"]["_bitshift64Lshr"].apply(null, arguments)
            };
            var _bitshift64Shl = Module["_bitshift64Shl"] = function () {
                return Module["asm"]["_bitshift64Shl"].apply(null, arguments)
            };
            var _emscripten_replace_memory = Module["_emscripten_replace_memory"] = function () {
                return Module["asm"]["_emscripten_replace_memory"].apply(null, arguments)
            };
            var _fflush = Module["_fflush"] = function () {
                return Module["asm"]["_fflush"].apply(null, arguments)
            };
            var _free = Module["_free"] = function () {
                return Module["asm"]["_free"].apply(null, arguments)
            };
            var _i64Add = Module["_i64Add"] = function () {
                return Module["asm"]["_i64Add"].apply(null, arguments)
            };
            var _i64Subtract = Module["_i64Subtract"] = function () {
                return Module["asm"]["_i64Subtract"].apply(null, arguments)
            };
            var _llvm_bswap_i16 = Module["_llvm_bswap_i16"] = function () {
                return Module["asm"]["_llvm_bswap_i16"].apply(null, arguments)
            };
            var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = function () {
                return Module["asm"]["_llvm_bswap_i32"].apply(null, arguments)
            };
            var _llvm_rint_f64 = Module["_llvm_rint_f64"] = function () {
                return Module["asm"]["_llvm_rint_f64"].apply(null, arguments)
            };
            var _llvm_round_f32 = Module["_llvm_round_f32"] = function () {
                return Module["asm"]["_llvm_round_f32"].apply(null, arguments)
            };
            var _llvm_round_f64 = Module["_llvm_round_f64"] = function () {
                return Module["asm"]["_llvm_round_f64"].apply(null, arguments)
            };
            var _main = Module["_main"] = function () {
                return Module["asm"]["_main"].apply(null, arguments)
            };
            var _malloc = Module["_malloc"] = function () {
                return Module["asm"]["_malloc"].apply(null, arguments)
            };
            var _memcpy = Module["_memcpy"] = function () {
                return Module["asm"]["_memcpy"].apply(null, arguments)
            };
            var _memmove = Module["_memmove"] = function () {
                return Module["asm"]["_memmove"].apply(null, arguments)
            };
            var _memset = Module["_memset"] = function () {
                return Module["asm"]["_memset"].apply(null, arguments)
            };
            var _rintf = Module["_rintf"] = function () {
                return Module["asm"]["_rintf"].apply(null, arguments)
            };
            var _sbrk = Module["_sbrk"] = function () {
                return Module["asm"]["_sbrk"].apply(null, arguments)
            };
            var emtStackRestore = Module["emtStackRestore"] = function () {
                return Module["asm"]["emtStackRestore"].apply(null, arguments)
            };
            var emtStackSave = Module["emtStackSave"] = function () {
                return Module["asm"]["emtStackSave"].apply(null, arguments)
            };
            var emterpret = Module["emterpret"] = function () {
                return Module["asm"]["emterpret"].apply(null, arguments)
            };
            var establishStackSpace = Module["establishStackSpace"] = function () {
                return Module["asm"]["establishStackSpace"].apply(null, arguments)
            };
            var getEmtStackMax = Module["getEmtStackMax"] = function () {
                return Module["asm"]["getEmtStackMax"].apply(null, arguments)
            };
            var setAsyncState = Module["setAsyncState"] = function () {
                return Module["asm"]["setAsyncState"].apply(null, arguments)
            };
            var setEmtStackMax = Module["setEmtStackMax"] = function () {
                return Module["asm"]["setEmtStackMax"].apply(null, arguments)
            };
            var stackAlloc = Module["stackAlloc"] = function () {
                return Module["asm"]["stackAlloc"].apply(null, arguments)
            };
            var stackRestore = Module["stackRestore"] = function () {
                return Module["asm"]["stackRestore"].apply(null, arguments)
            };
            var stackSave = Module["stackSave"] = function () {
                return Module["asm"]["stackSave"].apply(null, arguments)
            };
            var dynCall_dd = Module["dynCall_dd"] = function () {
                return Module["asm"]["dynCall_dd"].apply(null, arguments)
            };
            var dynCall_did = Module["dynCall_did"] = function () {
                return Module["asm"]["dynCall_did"].apply(null, arguments)
            };
            var dynCall_didd = Module["dynCall_didd"] = function () {
                return Module["asm"]["dynCall_didd"].apply(null, arguments)
            };
            var dynCall_diii = Module["dynCall_diii"] = function () {
                return Module["asm"]["dynCall_diii"].apply(null, arguments)
            };
            var dynCall_fii = Module["dynCall_fii"] = function () {
                return Module["asm"]["dynCall_fii"].apply(null, arguments)
            };
            var dynCall_fiii = Module["dynCall_fiii"] = function () {
                return Module["asm"]["dynCall_fiii"].apply(null, arguments)
            };
            var dynCall_fiiii = Module["dynCall_fiiii"] = function () {
                return Module["asm"]["dynCall_fiiii"].apply(null, arguments)
            };
            var dynCall_fiiiiiiiiffii = Module["dynCall_fiiiiiiiiffii"] = function () {
                return Module["asm"]["dynCall_fiiiiiiiiffii"].apply(null, arguments)
            };
            var dynCall_ii = Module["dynCall_ii"] = function () {
                return Module["asm"]["dynCall_ii"].apply(null, arguments)
            };
            var dynCall_iii = Module["dynCall_iii"] = function () {
                return Module["asm"]["dynCall_iii"].apply(null, arguments)
            };
            var dynCall_iiifii = Module["dynCall_iiifii"] = function () {
                return Module["asm"]["dynCall_iiifii"].apply(null, arguments)
            };
            var dynCall_iiii = Module["dynCall_iiii"] = function () {
                return Module["asm"]["dynCall_iiii"].apply(null, arguments)
            };
            var dynCall_iiiii = Module["dynCall_iiiii"] = function () {
                return Module["asm"]["dynCall_iiiii"].apply(null, arguments)
            };
            var dynCall_iiiiii = Module["dynCall_iiiiii"] = function () {
                return Module["asm"]["dynCall_iiiiii"].apply(null, arguments)
            };
            var dynCall_iiiiiii = Module["dynCall_iiiiiii"] = function () {
                return Module["asm"]["dynCall_iiiiiii"].apply(null, arguments)
            };
            var dynCall_iiiiiiidiiddii = Module["dynCall_iiiiiiidiiddii"] = function () {
                return Module["asm"]["dynCall_iiiiiiidiiddii"].apply(null, arguments)
            };
            var dynCall_iiiiiiii = Module["dynCall_iiiiiiii"] = function () {
                return Module["asm"]["dynCall_iiiiiiii"].apply(null, arguments)
            };
            var dynCall_iiiiiiiii = Module["dynCall_iiiiiiiii"] = function () {
                return Module["asm"]["dynCall_iiiiiiiii"].apply(null, arguments)
            };
            var dynCall_iiiiiiiiii = Module["dynCall_iiiiiiiiii"] = function () {
                return Module["asm"]["dynCall_iiiiiiiiii"].apply(null, arguments)
            };
            var dynCall_iiiiiiiiiiiiiifii = Module["dynCall_iiiiiiiiiiiiiifii"] = function () {
                return Module["asm"]["dynCall_iiiiiiiiiiiiiifii"].apply(null, arguments)
            };
            var dynCall_v = Module["dynCall_v"] = function () {
                return Module["asm"]["dynCall_v"].apply(null, arguments)
            };
            var dynCall_vi = Module["dynCall_vi"] = function () {
                return Module["asm"]["dynCall_vi"].apply(null, arguments)
            };
            var dynCall_vii = Module["dynCall_vii"] = function () {
                return Module["asm"]["dynCall_vii"].apply(null, arguments)
            };
            var dynCall_viidi = Module["dynCall_viidi"] = function () {
                return Module["asm"]["dynCall_viidi"].apply(null, arguments)
            };
            var dynCall_viifi = Module["dynCall_viifi"] = function () {
                return Module["asm"]["dynCall_viifi"].apply(null, arguments)
            };
            var dynCall_viii = Module["dynCall_viii"] = function () {
                return Module["asm"]["dynCall_viii"].apply(null, arguments)
            };
            var dynCall_viiif = Module["dynCall_viiif"] = function () {
                return Module["asm"]["dynCall_viiif"].apply(null, arguments)
            };
            var dynCall_viiiff = Module["dynCall_viiiff"] = function () {
                return Module["asm"]["dynCall_viiiff"].apply(null, arguments)
            };
            var dynCall_viiii = Module["dynCall_viiii"] = function () {
                return Module["asm"]["dynCall_viiii"].apply(null, arguments)
            };
            var dynCall_viiiif = Module["dynCall_viiiif"] = function () {
                return Module["asm"]["dynCall_viiiif"].apply(null, arguments)
            };
            var dynCall_viiiifii = Module["dynCall_viiiifii"] = function () {
                return Module["asm"]["dynCall_viiiifii"].apply(null, arguments)
            };
            var dynCall_viiiii = Module["dynCall_viiiii"] = function () {
                return Module["asm"]["dynCall_viiiii"].apply(null, arguments)
            };
            var dynCall_viiiiii = Module["dynCall_viiiiii"] = function () {
                return Module["asm"]["dynCall_viiiiii"].apply(null, arguments)
            };
            var dynCall_viiiiiiff = Module["dynCall_viiiiiiff"] = function () {
                return Module["asm"]["dynCall_viiiiiiff"].apply(null, arguments)
            };
            var dynCall_viiiiiifi = Module["dynCall_viiiiiifi"] = function () {
                return Module["asm"]["dynCall_viiiiiifi"].apply(null, arguments)
            };
            var dynCall_viiiiiii = Module["dynCall_viiiiiii"] = function () {
                return Module["asm"]["dynCall_viiiiiii"].apply(null, arguments)
            };
            var dynCall_viiiiiiifi = Module["dynCall_viiiiiiifi"] = function () {
                return Module["asm"]["dynCall_viiiiiiifi"].apply(null, arguments)
            };
            var dynCall_viiiiiiii = Module["dynCall_viiiiiiii"] = function () {
                return Module["asm"]["dynCall_viiiiiiii"].apply(null, arguments)
            };
            var dynCall_viiiiiiiii = Module["dynCall_viiiiiiiii"] = function () {
                return Module["asm"]["dynCall_viiiiiiiii"].apply(null, arguments)
            };
            var dynCall_viiiiiiiiii = Module["dynCall_viiiiiiiiii"] = function () {
                return Module["asm"]["dynCall_viiiiiiiiii"].apply(null, arguments)
            };
            var dynCall_viiiiiiiiiii = Module["dynCall_viiiiiiiiiii"] = function () {
                return Module["asm"]["dynCall_viiiiiiiiiii"].apply(null, arguments)
            };
            var dynCall_viiiiiiiiiiii = Module["dynCall_viiiiiiiiiiii"] = function () {
                return Module["asm"]["dynCall_viiiiiiiiiiii"].apply(null, arguments)
            };
            var dynCall_viiiiiiiiiiiiii = Module["dynCall_viiiiiiiiiiiiii"] = function () {
                return Module["asm"]["dynCall_viiiiiiiiiiiiii"].apply(null, arguments)
            };
            Module["asm"] = asm;
            Module["then"] = function (func) {
                if (Module["calledRun"]) {
                    func(Module)
                } else {
                    var old = Module["onRuntimeInitialized"];
                    Module["onRuntimeInitialized"] = function () {
                        if (old) old();
                        func(Module)
                    }
                }
                return Module
            };

            function ExitStatus(status) {
                this.name = "ExitStatus";
                this.message = "Program terminated with exit(" + status + ")";
                this.status = status
            }

            ExitStatus.prototype = new Error;
            ExitStatus.prototype.constructor = ExitStatus;
            var calledMain = false;
            dependenciesFulfilled = function runCaller() {
                if (!Module["calledRun"]) run();
                if (!Module["calledRun"]) dependenciesFulfilled = runCaller
            };
            Module["callMain"] = function callMain(args) {
                args = args || [];
                ensureInitRuntime();
                var argc = args.length + 1;
                var argv = stackAlloc((argc + 1) * 4);
                HEAP32[argv >> 2] = allocateUTF8OnStack(Module["thisProgram"]);
                for (var i = 1; i < argc; i++) {
                    HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1])
                }
                HEAP32[(argv >> 2) + argc] = 0;
                var initialEmtStackTop = Module["emtStackSave"]();
                try {
                    var ret = Module["_main"](argc, argv, 0);
                    if (typeof EmterpreterAsync === "object" && EmterpreterAsync.state !== 1) {
                        exit(ret, true)
                    }
                } catch (e) {
                    if (e instanceof ExitStatus) {
                        return
                    } else if (e == "SimulateInfiniteLoop") {
                        Module["noExitRuntime"] = true;
                        Module["emtStackRestore"](initialEmtStackTop);
                        return
                    } else {
                        var toLog = e;
                        if (e && typeof e === "object" && e.stack) {
                            toLog = [e, e.stack]
                        }
                        err("exception thrown: " + toLog);
                        Module["quit"](1, e)
                    }
                } finally {
                    calledMain = true
                }
            };

            function run(args) {
                args = args || Module["arguments"];
                if (runDependencies > 0) {
                    return
                }
                preRun();
                if (runDependencies > 0) return;
                if (Module["calledRun"]) return;

                function doRun() {
                    if (Module["calledRun"]) return;
                    Module["calledRun"] = true;
                    if (ABORT) return;
                    ensureInitRuntime();
                    preMain();
                    if (Module["onRuntimeInitialized"]) Module["onRuntimeInitialized"]();
                    if (Module["_main"] && shouldRunNow) Module["callMain"](args);
                    postRun()
                }

                if (Module["setStatus"]) {
                    Module["setStatus"]("Running...");
                    setTimeout(function () {
                        setTimeout(function () {
                            Module["setStatus"]("")
                        }, 1);
                        doRun()
                    }, 1)
                } else {
                    doRun()
                }
            }

            Module["run"] = run;

            function exit(status, implicit) {
                if (implicit && Module["noExitRuntime"] && status === 0) {
                    return
                }
                if (Module["noExitRuntime"]) {
                } else {
                    ABORT = true;
                    EXITSTATUS = status;
                    exitRuntime();
                    if (Module["onExit"]) Module["onExit"](status)
                }
                Module["quit"](status, new ExitStatus(status))
            }

            function abort(what) {
                if (Module["onAbort"]) {
                    Module["onAbort"](what)
                }
                if (what !== undefined) {
                    out(what);
                    err(what);
                    what = JSON.stringify(what)
                } else {
                    what = ""
                }
                ABORT = true;
                EXITSTATUS = 1;
                throw"abort(" + what + "). Build with -s ASSERTIONS=1 for more info."
            }

            Module["abort"] = abort;
            if (Module["preInit"]) {
                if (typeof Module["preInit"] == "function") Module["preInit"] = [Module["preInit"]];
                while (Module["preInit"].length > 0) {
                    Module["preInit"].pop()()
                }
            }
            var shouldRunNow = true;
            if (Module["noInitialRun"]) {
                shouldRunNow = false
            }
            run();


            return aconv
        }
    );
})();
if (typeof exports === 'object' && typeof module === 'object')
    module.exports = aconv;
else if (typeof define === 'function' && define['amd'])
    define([], function () {
        return aconv;
    });
else if (typeof exports === 'object')
    exports["aconv"] = aconv;
    