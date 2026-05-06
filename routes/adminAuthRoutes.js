const express = require('express'); 
const jsonWebToken = require('jsonwebtoken'); 

const { getCollection } = require('../db'); 

const router = express.Router(); 

router.post('/admin/login', async (req, res) => {

    try {

        const email = String(req.body.email || '').trim().toLowerCase(); 
        if (!email) return res.status(400).json({ ok: false, message: 'Email is required.'});

        const adminsCollection = getCollection('admins'); 
        const adminRecord = await adminsCollection.findOne({ email });
        if (!adminRecord) return res.status(401).json({ ok: false, message: 'Invalid admin email.'});

        const tokenSecretKey = process.env.JWT_SECRET;
        if (!tokenSecretKey) return res.status(500).json({ ok: false, message: 'JWT secret key is missing.' });

        const authToken = jsonWebToken.sign(
            { email }, 
            tokenSecretKey, 
            { expiresIn: '2h' }
        );

        return res.status(200).json({ ok: true, message: 'Admin login successful.', token: authToken});

    } catch (error) {
        console.error('Admin login error: ', error); 
        return res.status(500).json({ ok: false, message: 'Admin login failed.'});
    }

});

module.exports = router; 