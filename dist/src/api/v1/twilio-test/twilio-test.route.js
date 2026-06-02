"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const role_middleware_1 = require("../middleware/role.middleware");
const twilio_test_controller_1 = require("./twilio-test.controller");
const router = (0, express_1.Router)();
router.post("/send", auth_middleware_1.requiredAuth, role_middleware_1.isAdmin, twilio_test_controller_1.sendTwilioTestMessage);
exports.default = router;
