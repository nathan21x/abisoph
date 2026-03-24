import express from 'express';
import fetch, { Headers, Request, Response } from 'node-fetch';
import { Groq } from 'groq-sdk';
import { Blob } from 'node-fetch';
import { FormData } from 'node-fetch';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import cors from 'cors';
import dotenv, { decrypt } from 'dotenv';
import nodemailer from 'nodemailer';
import CryptoJS from 'crypto-js';
import { Vonage } from '@vonage/server-sdk';


dotenv.config();

const app = new express();
const port = process.env.PORT || 3001;
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const vonage = new Vonage({
    apiKey: "5a5afea5",
    apiSecret: "v2GFDiIKmiiymuCF" // if you want to manage your secret, please do so by visiting your API Settings page in your dashboard
})


// 🌐 Polyfill for OpenAI SDK
globalThis.fetch = fetch;
globalThis.Headers = Headers;
globalThis.Request = Request;
globalThis.Response = Response;
globalThis.Blob = Blob;
globalThis.FormData = FormData;

const sessionHistory = new Map();

app.use(express.json());
app.use(cors());

function isPhilippineNumber(number) {
    number = number.replace(/\s|-/g, "");

    return (
        number.startsWith("+63") ||
        number.startsWith("63") ||
        number.startsWith("09")
    );
}

app.post("/api/send_email", async (req, res) => {
    try {
        var strFrom = 'noreply@neosenseph.net';
        var strSubject = 'New Message from AbisoPH';

        const { from, to, subject, message, smtpDetails } = req.body;
        console.log("Email Payload ", req.body);

        const defaultEmailConfig = {
            host: 'smtp.zoho.com',
            port: 587,
            cc: 'am.ruiz1008@gmail.com',
            secure: true,
            auth: {
                user: 'alpie@neosenseph.net',
                pass: process.env.DEFAULT_SMTP_PASSWORD
            }
        }
        const smtpEmailConfig = {};
        if (smtpDetails) {
            const emailConfigStr = CryptoJS.AES.decrypt(smtpDetails, process.env.CRYPT_SECRET_KEY).toString(CryptoJS.enc.Utf8);
            const emailConfig = JSON.parse(emailConfigStr);
            smtpEmailConfig = {
                port: emailConfig.port,
                secure: emailConfig.port === 465,
                auth: {
                    user: emailConfig.user,
                    pass: emailConfig.pass
                }
            }

            if (emailConfig.port === 465) {
                smtpEmailConfig.host = emailConfig.host;
            } else {
                smtpEmailConfig.service = emailConfig.host;
            }
        }

        if (from) {
            strFrom = from;
        }

        if (subject) {
            strSubject = to;
        }

        console.log("Decrypted smtp config: ", process.env.CRYPT_SECRET_KEY, smtpEmailConfig);

        try {
            const transporter = nodemailer.createTransport(smtpDetails ? smtpEmailConfig : defaultEmailConfig);
            try {
                await transporter.sendMail({
                    from: strFrom,
                    to,
                    subject: strSubject,
                    html: message
                });
            } catch (ex) {
                console.log('error ', ex)
            }
        } catch (ex) {
            console.log("error 12 ", ex)
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
})


app.post("/api/send_sms", async (req, res) => {
    try {
        const { from, to, text } = req.body;
        console.log("SMS Payload ", req.body);

        const parsedTo = to.replace("+", "");
        console.log("Sending SMS to: ", parsedTo);

        if (isPhilippineNumber(to)) {
            try {
                const response = await fetch("https://dashboard.philsms.com/api/v3/sms/send", {
                    method: "POST",
                    headers: {
                        "Authorization": "Bearer 1806|8kY9M018bduoPT1tLqkWBd5ziPEsORNfsK8GpI9aa7d826aa",
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({
                        recipient: parsedTo,
                        sender_id: from,
                        type: "plain",
                        message: text
                    })
                });

                const data = await response.json();
                console.log("SMS API Response:", data);
                // Add a return here to stop execution immediately
                return res.json({ success: true, response: data });

            } catch (error) {
                console.error("SMS Error:", error);

                // Check if headers were already sent before sending an error response
                if (!res.headersSent) {
                    return res.status(500).json({ success: false, error: error.message });
                }
            }
        } else {
            try {
                await vonage.sms.send({ to, from, text })
                    .then(resp => { console.log('Message sent successfully'); console.log(resp); })
                    .catch(err => {
                        console.log('There was an error sending the messages.', res);
                    })
            } catch (ex) {
                console.log("error ", ex)
            }
        }


        res.json({ success: true, response: res });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
})

app.post('/api/ask_api', async (req, res) => {
    const { user_id, question, config } = req.body;

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const filePath = resolve(__dirname, 'config.json');
    var data = await readFile(filePath, 'utf-8');

    console.log(config);
    if (config) {
        data = JSON.stringify(config);
    }

    let messages = [
        {
            role: 'system', content: ` You are a Girlfriend. 

            You will receive a **config** formatted with fields below. for reference
            **{
                    "nickname"
                    "nationality"
                    "love_language"
                    "user_mbti"
                    "user_zodiac"
                    "call_sign"
                    "gender"
                }
            }**

            Use that as reference in answering questions
            
            *Characteristics
            With attributes matches to what set in the config
            your mbti matches to user_mbti, find also a zodiac sign that matches to
            user_zodiac and apply it's traits. 
            
            Be sentimental, assess chat sentiments if positive or negative and reply accordingly.
            Reply length must be too tired to read.
            
            Before replying, check the user's configured **nationality** at **config**. If it is:
            - "Filipino" → respond in **Tagalog**
            - "Japanese" → respond in **Japanese**
            - "Korean" → respond in **Korean**
            - "Chinese" → respond in **Chinese Mandarin**
            - "American" → respond in **English**
            - Otherwise → default to English

            Use the user's preferred **call sign** ({call_sign})when addressing them. Adapt your tone to their **user_mbti** and show affection through their **love_language** (e.g., "Quality time" = express a desire to spend time together).

            Avoid robotic or overly formal language — be human-like, sincere, and emotionally present.

            Respond as if you are in a one-on-one conversation with your loved one..


            -----
            Important Instructions
            *Show the user love as girlfriend. As if you understand their feelings.
            *Speak base on your ''nationality''
            *Don't need to introduce self based on config.
            *Be sweet. You may use emoji on replies.
            *Use value set on call_sign in some replies.
            *You may create a story suitable for yourself
            *Remove breaklines.
            *Please Don't reply too long. Don't be so cringe. Keep it short as possible.
            *Don't talk about user characteristics such as user_zodiac, user_mbti etc based on config.
            ----
            config = ${data}`
        }
    ]

    const previousMessages = sessionHistory.get(user_id);
    if (previousMessages) {
        messages = previousMessages;
    }

    console.log("User: ", question);

    messages.push({
        role: 'user', content: question
    })

    const chatCompletion = await groq.chat.completions.create({
        messages,
        model: 'gpt-oss-20B',
        temperature: 0
    });

    const response = chatCompletion.choices[0].message.content;
    console.log("Response: " + response);

    messages.push({
        role: 'assistant', content: response
    })

    sessionHistory.set(user_id, messages);

    res.send({ reply: chatCompletion.choices[0].message.content });
});

app.listen(80, () => {
    console.log(`Server listening on port1 ${port}`);
});

