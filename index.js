import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import admin from 'firebase-admin';
import { randomBytes } from 'crypto';
import cron from 'node-cron';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Buffer } from 'buffer';
import sharp from 'sharp';
import cors from 'cors';

const deleteImage = (imagePath) => {
    setTimeout(() => {
        fs.unlink(imagePath, (err) => {
            if (err) console.error(`Error deleting file: ${imagePath}`, err);
        });
    }, 120000); 
};

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
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
}

dotenv.config();

const firebaseConfig = {
    credential: admin.credential.cert(JSON.parse(process.env.SERVICE_ACCOUNT_KEY)),
    storageBucket: "codepulse-india.appspot.com"
};

const storage = admin.initializeApp(firebaseConfig).storage();

const dbURI = process.env.MONGODB_URI;
mongoose.connect(dbURI);

const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => {
    console.log("Connected to MongoDB");
});

const userSchema = new mongoose.Schema({
    username: String,
    lastRequestTimestamp: Date,
    requestsMade: Number,
    userType: String,
    premiumExpiration: Date,
    uid: String 
});

const User = mongoose.model('User', userSchema);
const router = express.Router();


app.get('/', (req, res) => {
    res.send('Server is running');
});

async function isValidAndroidId(androidId) {
    if (typeof androidId !== 'string') {
        return false;
    }

    if (androidId.length !== 16) {
        return false;
    }

    for (let i = 0; i < androidId.length; i++) {
        const charCode = androidId.charCodeAt(i);
        if (!((charCode >= 48 && charCode <= 57) ||
              (charCode >= 65 && charCode <= 70) ||
              (charCode >= 97 && charCode <= 102))) {
            return false;
        }
    }

    return true;
}

async function isValidIP(ipAddress) {
    const ipv4Regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(ipAddress);
}

async function checkProxyOrVPN(ipAddress) {
    // Custom logic to check if the IP is from a proxy or VPN
    // Implement as per your requirements
}
app.get('/year', async (req, res) => {
    const androidId = req.query.id;

    if (!androidId) {
        return res.status(400).json({ error: 'Android ID is required.' });
    }

    try {
        const isValidId = await isValidAndroidId(androidId);
        if (!isValidId) {
            return res.status(403).json({ error: 'Invalid Android ID.' });
        }

        let user = await User.findOne({ username: androidId });

        const expirationDate = new Date();
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);

        if (!user) {
            user = await User.create({ username: androidId, lastRequestTimestamp: Date.now(), requestsMade: 0, userType: 'PAID', premiumExpiration: expirationDate });
        } else {
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

    if (!androidId) {
        return res.status(400).json({ error: 'Android ID is required.' });
    }

    try {
        const isValidId = await isValidAndroidId(androidId);
        if (!isValidId) {
            return res.status(403).json({ error: 'Invalid Android ID.' });
        }

        let user = await User.findOne({ username: androidId });

        const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        if (!user) {
            user = await User.create({ username: androidId, lastRequestTimestamp: Date.now(), requestsMade: 0, userType: 'PAID', premiumExpiration: expirationDate });
        } else {
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

        const isValidId = await isValidAndroidId(androidId);
        if (!isValidId) {
            return res.status(400).json({ error: 'Invalid Android ID.' });
        }

        const user = await User.findOne({ username: androidId });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const userType = user.userType === 'PAID' ? 'PAID' : 'FREE';
        res.json({ msg: userType });
    } catch (error) {
        console.error("Error retrieving user data:", error);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
});

const SERVER_URL = process.env.SERVER_URL; 

app.get('/imagine', async (req, res) => {
    const prompt = req.query.prompt;

    if (!prompt) {
        return res.status(400).json({ error: "No prompt provided" });
    }

    const url = "https://ai-api.magicstudio.com/api/ai-art-generator";

    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0",
        "Accept": "application/json, text/plain, */*",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "en-US,en;q=0.9",
        "Origin": "https://magicstudio.com",
        "Referer": "https://magicstudio.com/ai-art-generator/",
    };

    const data = {
        "prompt": prompt,
        "output_format": "bytes",
        "user_profile_id": "null",
        "anonymous_user_id": "c75c20fe-57af-4d71-86fd-754b82b4bf54",
        "request_timestamp": Date.now().toString(),
        "user_is_subscribed": "false",
        "client_id": "pSgX7WgjukXCBoYwDM8G8GLnRRkvAoJlqa5eAVvj95o"
    };

    try {
        const response = await axios.post(url, data, { headers, responseType: 'arraybuffer' });

        if (response.status === 200) {
            const imgBuffer = Buffer.from(response.data, 'binary');
            const timestamp = Date.now();
            const imagePath = path.join(__dirname, 'images', `${timestamp}.png`);
            await sharp(imgBuffer).toFile(imagePath);
            deleteImage(imagePath);
            return res.json({ img: `${SERVER_URL}/images/${timestamp}.png` });
        } else {
            console.error(`Error: Failed to fetch image. Status code: ${response.status}, Status text: ${response.statusText}, Response data: ${JSON.stringify(response.data)}`);
            return res.status(500).json({ error: `Failed to fetch image. Status code: ${response.status}, Status text: ${response.statusText}` });
            }
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

app.get('/images/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, 'images', filename);
    if (fs.existsSync(filepath)) {
        return res.sendFile(filepath);
    } else {
        return res.status(404).json({ error: "Image not found" });
    }
});


app.get('/info/:androidId', async (req, res) => {
    try {
        const androidId = req.params.androidId;

        if (!await isValidAndroidId(androidId)) {
            return res.status(400).json({ error: 'Invalid Android ID format.' });
        }

        const user = await User.findOne({ username: androidId });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

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

        const isValidId = await isValidAndroidId(androidId);
        if (!isValidId) {
            return res.status(400).json({ error: 'Invalid Android ID.' });
        }

        let user = await User.findOne({ username: androidId });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        user.userType = 'BANNED';
        await user.save();

        res.json({ message: 'User banned successfully.' });
    } catch (error) {
        console.error("Error banning user:", error);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
});

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
        if (!isValidId) {
            return res.status(403).json({ error: 'Invalid Android ID.' });
        }

        if (uid) {
            const firebaseUser = await admin.auth().getUser(uid);
            if (!firebaseUser.emailVerified) {
                return res.status(403).json({ error: 'Email is not verified.' });
            }
        }

        const userByAndroidId = androidId ? await User.findOne({ username: androidId }) : null;
        const userByUid = uid ? await User.findOne({ uid: uid }) : null;

        let user;
        if (userByAndroidId && userByUid) {
            user = userByUid;
        } else if (userByAndroidId) {
            user = userByAndroidId;
        } else {
            user = userByUid;
        }

        if (!user) {
            const expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const newUser = { lastRequestTimestamp: Date.now(), requestsMade: 1, userType: 'FREE', premiumExpiration: expirationDate };
            if (androidId) newUser.username = androidId;
            if (uid) newUser.uid = uid;
            await User.create(newUser);
        } else {
            if (user.userType === 'BANNED') {
                return res.status(403).json({ error: 'User is banned. Upgrade to pro to access the service.' });
            }
            if (user.userType === 'FREE' && user.requestsMade >= 3) {
                return res.status(403).json({ error: 'Daily limit exceeded for free users. Upgrade to pro for unlimited access.' });
            }
            const now = Date.now();
            if (user.lastRequestTimestamp && !isSameDay(now, user.lastRequestTimestamp)) {
                user.requestsMade = 0;
            }
            user.requestsMade++;
            user.lastRequestTimestamp = now;
            await user.save();
        }

        const imageUrl = await getProLLMResponse(prompt);
        if (imageUrl.error) {
            return res.status(500).json({ error: imageUrl.error });
        }

        res.json({ code: 200, url: imageUrl });
    } catch (error) {
        console.error("Internal server error:", error);
        res.status(500).json({ error: 'Internal server error. Please try again later.' });
    }
});


async function getProLLMResponse(prompt) {
    try {
        const seedBytes = randomBytes(4);
        const seed = seedBytes.readUInt32BE();

        const data = {
            width: 1024,
            height: 1024,
            seed: seed,
            num_images: 1,
            modelType: process.env.MODEL_TYPE,
            sampler: 9,
            cfg_scale: 3,
            guidance_scale: 3,
            strength: 1.7,
            steps: 30,
            high_noise_frac: 1,
            negativePrompt: 'ugly, deformed, noisy, blurry, distorted, out of focus, bad anatomy, extra limbs, poorly drawn face, poorly drawn hands, missing fingers',
            prompt: prompt,
            hide: false,
            isPrivate: false,
            batchId: '0yU1CQbVkr',
            generateVariants: false,
            initImageFromPlayground: false,
            statusUUID: process.env.STATUS_UUID
        };

        const response = await fetch(process.env.BACKEND_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': process.env.COOKIES
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            console.error("Failed to generate LLM response. HTTP status:", response.status);
            return { error: 'Failed to generate LLM response. Please try again later.' };
        }

        const json = await response.json();

        if (!json.images || !json.images[0] || !json.images[0].imageKey) {
            console.error("Failed to parse LLM response:", json);
            return { error: 'Failed to parse LLM response. Please try again later.' };
        }

        const imageUrl = `https://images.playground.com/${json.images[0].imageKey}.jpeg`;

        return imageUrl;
    } catch (error) {
        console.error("Error generating LLM response:", error);
        return { error: 'Internal server error. Please try again later.' };
    }
}

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
