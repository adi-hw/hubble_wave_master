"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var axios_1 = __importDefault(require("axios"));
var fs_1 = require("fs");
var path_1 = require("path");
var API_URL = 'http://localhost:3000/api/metadata'; // Adjust if needed
var OUTPUT_DIR = (0, path_1.join)(__dirname, '../libs/generated-types/src/lib');
function generateTypes() {
    return __awaiter(this, void 0, void 0, function () {
        var response, tables, content, _i, tables_1, table, className, _a, _b, field, tsType, optional, error_1;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 4, , 5]);
                    console.log('Fetching metadata...');
                    return [4 /*yield*/, axios_1.default.get("".concat(API_URL, "/tables"))];
                case 1:
                    response = _c.sent();
                    tables = response.data;
                    // Ensure output directory exists
                    return [4 /*yield*/, fs_1.promises.mkdir(OUTPUT_DIR, { recursive: true }).catch(function () { })];
                case 2:
                    // Ensure output directory exists
                    _c.sent();
                    content = "// Auto-generated types\n\n";
                    for (_i = 0, tables_1 = tables; _i < tables_1.length; _i++) {
                        table = tables_1[_i];
                        className = table.tableName.charAt(0).toUpperCase() + table.tableName.slice(1);
                        content += "export interface ".concat(className, " {\n");
                        content += "  id: string;\n";
                        for (_a = 0, _b = table.fields; _a < _b.length; _a++) {
                            field = _b[_a];
                            tsType = 'any';
                            switch (field.type) {
                                case 'string':
                                case 'text':
                                case 'email':
                                case 'url':
                                case 'phone':
                                case 'reference':
                                case 'user_reference':
                                case 'choice': // Could be union if options known
                                    tsType = 'string';
                                    break;
                                case 'integer':
                                case 'decimal':
                                case 'number':
                                case 'currency':
                                case 'percent':
                                    tsType = 'number';
                                    break;
                                case 'boolean':
                                    tsType = 'boolean';
                                    break;
                                case 'date':
                                case 'datetime':
                                    tsType = 'Date | string';
                                    break;
                                case 'json':
                                    tsType = 'any';
                                    break;
                            }
                            optional = !field.required ? '?' : '';
                            content += "  ".concat(field.name).concat(optional, ": ").concat(tsType, ";\n");
                        }
                        content += "}\n\n";
                    }
                    return [4 /*yield*/, fs_1.promises.writeFile((0, path_1.join)(OUTPUT_DIR, 'index.d.ts'), content)];
                case 3:
                    _c.sent();
                    console.log("Types generated in ".concat(OUTPUT_DIR, "/index.d.ts"));
                    return [3 /*break*/, 5];
                case 4:
                    error_1 = _c.sent();
                    console.error('Error generating types:', error_1);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
generateTypes();
