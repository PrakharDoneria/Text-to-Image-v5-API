import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import admin from 'firebase-admin';
import cron from 'node-cron';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import { v2 as cloudinary } from 'cloudinary';
import qs from 'qs';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const allowedOrigins = ['https://verbo-visions-web.vercel.app/', 'https://html-editor-pro.vercel.app/'];

const corsOptions = {
  origin: function (origin, callback) {
    if (allowedOrigins.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Na Munna Na ye Prakhar Doneria ka server hai isse bak*hodi nhi'));
    }
  }
};

app.use(cors(corsOptions));

function isSameDay(date1, date2) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

dotenv.config();

const firebaseConfig = {
    credential: admin.credential.cert(JSON.parse(process.env.SERVICE_ACCOUNT_KEY)),
    storageBucket: "codepulse-india.appspot.com"
};

admin.initializeApp(firebaseConfig);

const dbURI = process.env.MONGODB_URI;
mongoose.connect(dbURI);

const userSchema = new mongoose.Schema({
    username: String,
    lastRequestTimestamp: Date,
    requestsMade: Number,
    userType: String,
    premiumExpiration: Date,
    uid: String
});

const User = mongoose.model('User', userSchema);

app.get('/', (req, res) => {
    res.send('Server is running');
});

async function isValidAndroidId(androidId) {
    if (typeof androidId !== 'string') return false;
    if (androidId.length !== 16) return false;
    for (let i = 0; i < androidId.length; i++) {
        const charCode = androidId.charCodeAt(i);
        if (!((charCode >= 48 && charCode <= 57) || (charCode >= 65 && charCode <= 70) || (charCode >= 97 && charCode <= 102))) return false;
    }
    return true;
}

app.get('/year', async (req, res) => {
    const androidId = req.query.id;
    if (!androidId) return res.status(400).json({ error: 'Android ID is required.' });
    try {
        if (!await isValidAndroidId(androidId)) return res.status(403).json({ error: 'Invalid Android ID.' });
        let user = await User.findOne({ username: androidId });
        const expirationDate = new Date();
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);
        if (!user) user = await User.create({ username: androidId, lastRequestTimestamp: Date.now(), requestsMade: 0, userType: 'PAID', premiumExpiration: expirationDate });
        else {
            user.userType = 'PAID';
            user.premiumExpiration = expirationDate;
            await user.save();
        }
        res.json({ code: 200, message: 'Account upgraded to yearly premium successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
});

app.get('/banlist', async (req, res) => {
    try {
        const bannedUsers = await User.find({ userType: 'BANNED' });
        const bannedUserIds = bannedUsers.map(user => user.username);
        res.status(200).json({ code: "200", bannedUsers: bannedUserIds });
    } catch (error) {
        console.error("Error retrieving list of banned users:", error);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
});

app.get('/add', async (req, res) => {
    const androidId = req.query.id;
    if (!androidId) return res.status(400).json({ error: 'Android ID is required.' });
    try {
        if (!await isValidAndroidId(androidId)) return res.status(403).json({ error: 'Invalid Android ID.' });
        let user = await User.findOne({ username: androidId });
        const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        if (!user) user = await User.create({ username: androidId, lastRequestTimestamp: Date.now(), requestsMade: 0, userType: 'PAID', premiumExpiration: expirationDate });
        else {
            user.userType = 'PAID';
            user.premiumExpiration = expirationDate;
            await user.save();
        }
        res.json({ code: 200, message: 'Account upgraded to premium successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
});

app.get('/check/:androidId', async (req, res) => {
    try {
        const androidId = req.params.androidId;
        if (!await isValidAndroidId(androidId)) return res.status(400).json({ error: 'Invalid Android ID.' });
        const user = await User.findOne({ username: androidId });
        if (!user) return res.status(404).json({ error: 'User not found.' });
        const userType = user.userType === 'PAID' ? 'PAID' : 'FREE';
        res.json({ msg: userType });
    } catch (error) {
        console.error("Error retrieving user data:", error);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
});

app.get('/info/:androidId', async (req, res) => {
    try {
        const androidId = req.params.androidId;
        if (!await isValidAndroidId(androidId)) return res.status(400).json({ error: 'Invalid Android ID format.' });
        const user = await User.findOne({ username: androidId });
        if (!user) return res.status(404).json({ error: 'User not found.' });
        res.json({
            username: user.username,
            lastRequestTimestamp: user.lastRequestTimestamp,
            requestsMade: user.requestsMade,
            userType: user.userType,
            premiumExpiration: user.premiumExpiration
        });
    } catch (error) {
        console.error("Error retrieving user data:", error);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
});

app.get('/ban/:androidId', async (req, res) => {
    try {
        const androidId = req.params.androidId;
        if (!await isValidAndroidId(androidId)) return res.status(400).json({ error: 'Invalid Android ID.' });
        let user = await User.findOne({ username: androidId });
        if (!user) return res.status(404).json({ error: 'User not found.' });
        user.userType = 'BANNED';
        await user.save();
        res.json({ message: 'User banned successfully.' });
    } catch (error) {
        console.error("Error banning user:", error);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
});

cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL
});

const tempImageDir = path.join(__dirname, 'temp', 'images');
fs.mkdirSync(tempImageDir, { recursive: true });

app.post('/prompt', async (req, res) => {
    const { prompt, ip, androidId, uid } = req.body;

    const blocklist = [
        "prakhardoneria3@gmail.com",
        "gmail.com",
        "doneria",
        "fuck",
        "gaza",
        "israel",
        "palestine",
        "hamas",
        "shit",
        "bitch",
        "asshole",
        "bastard",
        "dick",
        "cunt",
        "whore",
        "slut",
        "nigger",
        "faggot",
        "motherfucker",
        "piss",
        "twat",
        "cock",
        "pussy",
        "bikini",
        "breast",
        "horny",
        "sexy",
    ];

    if (blocklist.some(blocked => prompt.toLowerCase().includes(blocked.toLowerCase()))) {
        return res.status(400).json({ error: 'The provided prompt contains a restricted term.' });
    }

    if (!prompt || !ip || (!androidId && !uid)) {
        return res.status(400).json({ error: 'Please update your application.' });
    }

    try {
        const isValidId = androidId ? await isValidAndroidId(androidId) : true;
        if (!isValidId) return res.status(403).json({ error: 'Invalid Android ID.' });

        if (uid) {
            const firebaseUser = await admin.auth().getUser(uid);
            if (!firebaseUser.emailVerified) return res.status(403).json({ error: 'Email is not verified.' });
        }

        const userByAndroidId = androidId ? await User.findOne({ username: androidId }) : null;
        const userByUid = uid ? await User.findOne({ uid: uid }) : null;

        let user;
        if (userByAndroidId && userByUid) user = userByUid;
        else if (userByAndroidId) user = userByAndroidId;
        else user = userByUid;

        if (!user) {
            const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const newUser = { lastRequestTimestamp: Date.now(), requestsMade: 1, userType: 'FREE', premiumExpiration: expirationDate };
            if (androidId) newUser.username = androidId;
            if (uid) newUser.uid = uid;
            await User.create(newUser);
        } else {
            if (user.userType === 'BANNED') return res.status(403).json({ error: 'User is banned. Upgrade to pro to access the service.' });
            if (user.userType === 'FREE' && user.requestsMade >= 3) return res.status(403).json({ error: 'Daily limit exceeded for free users. Upgrade to pro for unlimited access.' });
            const now = Date.now();
            if (user.lastRequestTimestamp && !isSameDay(now, user.lastRequestTimestamp)) user.requestsMade = 0;
            user.requestsMade++;
            user.lastRequestTimestamp = now;
            await user.save();
        }

        try {
            const metaAiResponse = await meta_ai_prompt(prompt);
            if (!metaAiResponse || !metaAiResponse.images || metaAiResponse.images.length === 0) return res.status(500).json({ error: 'Failed to generate image with Meta AI.' });

            const imageUrl = metaAiResponse.images[0].url;
            const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const imageBuffer = Buffer.from(imageResponse.data, 'binary');
            const uniqueFilename = `${randomUUID()}.jpg`;
            const tempFilePath = path.join(tempImageDir, uniqueFilename);

            fs.writeFileSync(tempFilePath, imageBuffer);

            const serverURL = process.env.SERVER_URL || 'https://visionary-sliq.onrender.com';
            const cloudinaryImageUrl = `${serverURL}/temp/images/${uniqueFilename}`;

            cloudinary.uploader.upload(cloudinaryImageUrl, { resource_type: 'image' })
                .then(result => {
                    fs.unlink(tempFilePath, (unlinkError) => {
                        if (unlinkError) console.warn("Error deleting temporary file:", unlinkError);
                    });

                    res.json({
                        url: result.secure_url,
                        img: result.secure_url,
                        app: "https://play.google.com/store/apps/details?id=com.protecgames.verbovisions"
                    });
                })
                .catch(error => {
                    console.error('Cloudinary upload error:', error);
                    fs.unlink(tempFilePath, (unlinkError) => {
                        if (unlinkError) console.warn("Error deleting temporary file after failed upload:", unlinkError);
                    });
                    res.status(500).json({ error: 'Failed to upload image to Cloudinary.' });
                });

        } catch (error) {
            console.error('Error while generating or uploading the image:', error);
            res.status(500).json({ error: 'An error occurred while generating or uploading the image' });
        }

    } catch (error) {
        console.error("Internal server error:", error);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
});

cron.schedule('0 1 * * *', async () => {
    try {
        await User.updateMany({}, { $set: { requestsMade: 0 } });
        console.log('Daily limit reset at 1 AM');
    } catch (error) {
        console.error('Error resetting daily limits:', error);
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

async function meta_ai_prompt(message, external_conversation_id) {
    const ok = await updateCookies("datr=p5xIZ0uIlx7zFlyuwDTOuyuG; abra_sess=Ft7ex9mulJUBFlIYDnJrTXZHdFVyeVRCU2NRFuLyxPQMAA%3D%3D; wd=1024x1366;");
    const authPayload = {
        fb_dtsg: ok.dtsg,
        lsd: ok.lsd
    };
    const url = `https://www.meta.ai/api/graphql/?fb_dtsg=${ok.dtsg}&lsd=${ok.lsd}`;
    const externalConversationId = !external_conversation_id ? randomUUID() : external_conversation_id;

    const payload = {
        ...authPayload,
        fb_api_caller_class: 'RelayModern',
        fb_api_req_friendly_name: 'useAbraSendMessageMutation',
        __user: 0,
        __a: 1,
        __req: "1j",
        __hs: "20109.HYP:abra_pkg.2.1.0.0.0",
        dpr: 2,
        __ccg: "GOOD",
        variables: JSON.stringify({
            message: { sensitive_string_value: message },
            externalConversationId: externalConversationId,
            offlineThreadingId: generateOfflineThreadingId(),
            suggestedPromptIndex: null,
            flashPreviewInput: null,
            promptPrefix: null,
            entrypoint: 'ABRA__CHAT__TEXT',
            icebreaker_type: 'TEXT_V2',
            attachments: [],
            attachmentsV2: [],
            activeMediaSets: null,
            activeCardVersions: [],
            activeArtifactVersion: null,
            userUploadEditModeInput: null,
            reelComposeInput: null,
            qplJoinId: "f66b4cd9e2f22e8c7",
            gkAbraArtifactsEnabled: false,
            model_preference_override: null,
            __relay_internal__pv__AbraDebugDevOnlyrelayprovider: false,
            __relay_internal__pv__WebPixelRatiorelayprovider: 2,
            __relay_internal__pv__AbraPinningConversationsrelayprovider: false,
            __relay_internal__pv__AbraArtifactsEnabledrelayprovider: false,
            __relay_internal__pv__AbraSearchInlineReferencesEnabledrelayprovider: true,
            __relay_internal__pv__AbraArtifactVersionCreationMessagerelayprovider: false,
            __relay_internal__pv__AbraSearchReferencesHovercardEnabledrelayprovider: true,
            __relay_internal__pv__AbraCardNavigationCountrelayprovider: true,
            __relay_internal__pv__AbraDebugDevOnlyrelayprovider: false,
            __relay_internal__pv__AbraHasNuxTourrelayprovider: true,
            __relay_internal__pv__AbraQPSidebarNuxTriggerNamerelayprovider: "meta_dot_ai_abra_web_message_actions_sidebar_nux_tour",
            __relay_internal__pv__AbraSurfaceNuxIDrelayprovider: "12177",
            __relay_internal__pv__AbraFileUploadsrelayprovider: false,
            __relay_internal__pv__AbraQPFileUploadTransparencyDisclaimerTriggerNamerelayprovider: "meta_dot_ai_abra_web_file_upload_transparency_disclaimer",
            __relay_internal__pv__AbraUpsellsKillswitchrelayprovider: true,
            __relay_internal__pv__AbraIcebreakerImagineFetchCountrelayprovider: 20,
            __relay_internal__pv__AbraImagineYourselfIcebreakersrelayprovider: false,
            __relay_internal__pv__AbraEmuReelsIcebreakersrelayprovider: false,
            __relay_internal__pv__AbraQueryFromQPInfrarelayprovider: false,
            __relay_internal__pv__AbraArtifactsEditorDiffingrelayprovider: false,
            __relay_internal__pv__AbraArtifactEditorDebugModerelayprovider: false,
            __relay_internal__pv__AbraArtifactsRenamingEnabledrelayprovider: false,
            __relay_internal__pv__AbraArtifactSharingrelayprovider: false,
            __relay_internal__pv__AbraArtifactEditorSaveEnabledrelayprovider: false,
            __relay_internal__pv__AbraArtifactEditorDownloadHTMLEnabledrelayprovider: false
        }),
        server_timestamps: 'true',
        doc_id: '7783822248314888',
    };

    const headers = {
        'x-fb-lsd': authPayload.lsd,
        'x-asbd-id': '129477',
        'content-type': 'application/x-www-form-urlencoded',
        'origin': 'https://www.meta.ai',
        'referer': 'https://www.meta.ai/'
    };

    headers['cookie'] = ok.cookies;

    try {
        const response = await axios.post(url, qs.stringify(payload), {
            headers,
            responseType: 'text'
        });

        const rawResponse = response.data;
        console.log(rawResponse);
        const lastStreamedResponse = extractLastResponse(rawResponse);
        fs.writeFileSync(`./meta_ai.json`, JSON.stringify(lastStreamedResponse, null, 2));
        return extractData(lastStreamedResponse);
    } catch (error) {

    }
}

function extractLastResponse(response) {
    let lastStreamedResponse = null;
    const lines = response.split('\n');
    for (const line of lines) {
        try {
            const jsonLine = JSON.parse(line);
            const botResponseMessage = jsonLine?.data?.node?.bot_response_message || {};
            const chatId = botResponseMessage?.id;

            if (botResponseMessage?.streaming_state === 'OVERALL_DONE') {
                lastStreamedResponse = jsonLine;
            }
        } catch (err) {
            continue;
        }
    }
    return lastStreamedResponse;
}

function extractData(jsonLine) {
    console.log(jsonLine.data.node);
    const botResponseMessage = jsonLine?.data?.node?.bot_response_message || {};
    const conversationResponseMessage = jsonLine?.data?.node?.conversation || {};
    console.log(botResponseMessage);
    let images = [];
    let videos = [];
    if (botResponseMessage.imagine_card) {
        images = extractMedia(botResponseMessage);
        videos = animate(botResponseMessage?.imagine_card?.session?.media_sets[0]?.media_set_id, conversationResponseMessage.external_conversation_id);
    }
    return {
        text: botResponseMessage.snippet,
        reels: botResponseMessage?.reels || {},
        search_results: botResponseMessage.search_results || {},
        images,
        videos,
        media_set_id: botResponseMessage?.imagine_card?.session?.media_sets[0]?.media_set_id || null,
        external_conversation_id: conversationResponseMessage.external_conversation_id
    };
}

function extractMedia(jsonLine) {
    const medias = [];
    const imagineCard = jsonLine?.imagine_card || {};
    const session = imagineCard?.session || {};
    const mediaSets = session?.media_sets || [];

    for (const mediaSet of mediaSets) {
        const imagineMedia = mediaSet?.imagine_media || [];
        for (const media of imagineMedia) {
            medias.push({
                url: media.uri,
                type: media.media_type,
                prompt: media.prompt,
            });
        }
    }
    return medias;
}

async function animate(media_id, external_conversation_id) {
    const ok = await updateCookies("datr=p5xIZ0uIlx7zFlyuwDTOuyuG; abra_sess=Ft7ex9mulJUBFlIYDnJrTXZHdFVyeVRCU2NRFuLyxPQMAA%3D%3D;");
    const authPayload = {
        fb_dtsg: ok.dtsg,
        lsd: ok.lsd
    };
    const url = 'https://www.meta.ai/api/graphql/';
    const externalConversationId = external_conversation_id;

    const payload = {
        ...authPayload,
        fb_api_caller_class: 'RelayModern',
        fb_api_req_friendly_name: 'useAbraImagineAnimateMutation',
        variables: JSON.stringify({
            "input": {
                "client_mutation_id": "2",
                "actor_id": "512054858655166",
                "external_conversation_id": externalConversationId,
                "image_id": null,
                "media_set_id": media_id,
                "media_type": "IMAGE"
            }
        }),
        server_timestamps: 'true',
        doc_id: '7938413782872932',
    };

    const headers = {
        'x-fb-lsd': authPayload.lsd,
        'x-asbd-id': '129477',
        'content-type': 'application/x-www-form-urlencoded',
        'x-fb-friendly-name': 'useAbraImagineAnimateMutation',
        'origin': 'https://www.meta.ai',
        'referer': `https://www.meta.ai/c/${externalConversationId}`
    };

    headers['cookie'] = ok.cookies;

    try {
        const response = await axios.post(url, qs.stringify(payload), {
            headers
        });

        const lastStreamedResponse = response.data;
        console.log(lastStreamedResponse);
        const botResponseMessage = lastStreamedResponse?.data || {};
        const kok = extractAnimatedMedia(botResponseMessage);
        return kok;
    } catch (error) {

    }
}

function extractAnimatedMedia(jsonLine) {
    const medias = [];
    const mediaSets = jsonLine?.media_set || {};
    const imagineMedia = mediaSets?.imagine_media || [];
    for (const media of imagineMedia) {
        medias.push({
            url: media.uri,
            type: media.media_type,
            prompt: media.prompt,
        });
    }
    return medias;
}

function generateOfflineThreadingId() {
    const MAX_INT = BigInt("0xFFFFFFFFFFFFFFFF");
    const MASK_22_BITS = BigInt("0x3FFFFF");

    function getCurrentTimestamp() {
        return BigInt(Date.now());
    }

    function getRandom64BitInt() {
        return BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
    }

    function combineAndMask(timestamp, randomValue) {
        const shiftedTimestamp = timestamp << BigInt(22);
        const maskedRandom = randomValue & MASK_22_BITS;
        return (shiftedTimestamp | maskedRandom) & MAX_INT;
    }

    const timestamp = getCurrentTimestamp();
    const randomValue = getRandom64BitInt();
    const threadingId = combineAndMask(timestamp, randomValue);

    return threadingId.toString();
}

async function updateCookies(cookies) {
    const response = await axios.get("https://www.meta.ai/", {
        headers: {
            "cookie": cookies,
            'origin': 'https://www.meta.ai',
            'referer': 'https://www.meta.ai/',
            'x-asbd-id': '129477',
            'User-Agent': 'okhttp/4.3.1'
        }
    });

    const text = response.data;
    const lsd = extractValue(text, null, '"LSD",[],{"token":"', '"}');
    const dtsg = extractValue(text, null, '"DTSGInitialData",[],{"token":"', '"}');
    console.log(lsd, dtsg);
    return {
        lsd,
        dtsg,
        cookies
    };
}

function extractValue(text, key = null, startStr = null, endStr = '",') {
    if (!startStr) {
        startStr = `${key}":{"value":"`;
    }
    const start = text.indexOf(startStr);
    if (start >= 0) {
        const adjustedStart = start + startStr.length;
        const end = text.indexOf(endStr, adjustedStart);
        if (end >= 0) {
            return text.substring(adjustedStart, end);
        }
    }
    return null;
}

app.use('/temp/images', express.static(path.join(__dirname, 'temp', 'images')));

// New endpoint to list stored images
app.get('/temp/images/', (req, res) => {
    fs.readdir(tempImageDir, (err, files) => {
        if (err) {
            console.error("Error reading directory:", err);
            return res.status(500).json({ error: 'Failed to read directory' });
        }

        // Filter out non-image files if needed
        const imageFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.jpg', '.jpeg', '.png', '.gif'].includes(ext);
        });

        // Construct URLs for each image
        const serverURL = process.env.SERVER_URL || 'https://visionary-sliq.onrender.com';
        const imageUrls = imageFiles.map(file => `${serverURL}/temp/images/${file}`);

        res.json({ images: imageUrls });
    });
});