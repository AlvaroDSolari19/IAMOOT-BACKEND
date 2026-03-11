require('dotenv').config(); 
const express = require('express'); 
const cors = require('cors');
const { connectToMongoDB } = require('./db'); 

const loginRoute = require('./routes/login');
const adminTeamsRoute = require('./routes/adminTeams');
const adminPrelimsRoute = require('./routes/adminPrelims'); 
const adminSemisRoute = require('./routes/adminSemis')
const judgeOralRoundsRoutes = require('./routes/judgeOralRounds');
const loginWrittenRoute = require('./routes/loginWritten');
const writtenParticipantsAuth = require('./routes/writtenParticipantsAuth'); 

const app = express(); 
const port = process.env.PORT || 3000; 

/* DROPBOX SETUP */
const { getDropboxClient } = require('./services/dropboxClient');

/* MIDDLEWARE */
app.use(cors({ origin: '*' }));
app.use(express.json()); 

/* ROUTES */
app.use('/api', loginRoute); 
app.use('/api', adminTeamsRoute); 
app.use('/api', adminPrelimsRoute); 
app.use('/api', adminSemisRoute);
app.use('/api', judgeOralRoundsRoutes);
app.use('/api', loginWrittenRoute);
app.use('/api', writtenParticipantsAuth);

app.get('/health', (req, res) => {
    res.json({ ok: true });
})

app.get('/api/dropbox/health', async (req, res) => {
    try {
        const dbx = await getDropboxClient();
        const accountResult = await dbx.usersGetCurrentAccount(); 

        return res.json({
            ok: true, 
            email: accountResult.result.email, 
            accountId: accountResult.result.account_id,
            name: accountResult.result.name?.display_name
        });
    } catch (error){
        return res.status(500).json({
            ok: false, 
            message: error?.message ?? String(error), 
            details: error?.error ?? null
        })
    }
})

async function startServer(){
    await connectToMongoDB();
    app.listen(port, () => console.log(`Server is running on port ${port}`));
}

startServer().catch( (err) => {
    console.error(`Server failed to start: ${err}`);
    process.exit(1); 
})