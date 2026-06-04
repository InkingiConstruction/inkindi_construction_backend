"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const openapi_1 = require("./openapi");
const router = (0, express_1.Router)();
router.get("/openapi.json", (_req, res) => {
    res.json(openapi_1.openApiDocument);
});
router.use("/docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(openapi_1.openApiDocument, {
    customSiteTitle: "Inkingi Construction API Docs",
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
    },
}));
exports.default = router;
