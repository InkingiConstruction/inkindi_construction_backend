import AfricasTalking from "africastalking";

const at = AfricasTalking({
  apiKey: process.env.AT_API_KEY!,
  username: process.env.AT_USERNAME!,
});

const sms = at.SMS;

export const sendSMS = async (to: string, message: string) => {
  await sms.send({
    to: [to],
    message,
  } as any);
};
