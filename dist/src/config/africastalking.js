"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendSMS = void 0;
const africastalking_1 = __importDefault(require("africastalking"));
const at = (0, africastalking_1.default)({
    apiKey: process.env.AT_API_KEY,
    username: process.env.AT_USERNAME,
});
const sms = at.SMS;
const sendSMS = async (to, message) => {
    await sms.send({
        to: [to],
        message,
    });
};
exports.sendSMS = sendSMS;
