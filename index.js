require('dotenv').config(); 
const express = require('express'); 
const cors = require('cors');
const { connectToMongoDB } = require('./db'); 

const adminTeamsRoute = require('./routes/adminTeams');
const adminPrelimsRoute = require('./routes/adminPrelims'); 
const adminSemisRoute = require('./routes/adminSemis')

const adminAuthRoutes = require('./routes/adminAuthRoutes'); 
const adminOralRoutes = require('./routes/adminOralRoutes');
const adminWrittenRoutes = require('./routes/adminWrittenRoutes');

const judgeOralRoundsRoutes = require('./routes/judgeOralRounds');
const participantRoutes = require('./routes/participants'); 
const writtenJudgesRoutes = require('./routes/writtenJudges');
const writtenMemorandaScoresRoutes = require('./routes/writtenMemorandaScores');
const writtenMemorandaLinksRoutes = require('./routes/writtenMemorandaLinks');
const oralJudgesRoutes = require('./routes/oralJudges');


const app = express(); 
const port = process.env.PORT || 3000; 

/* DROPBOX SETUP */
const { getDropboxClient } = require('./services/dropboxClient');

/* MIDDLEWARE */
app.use(cors({ origin: '*' }));
app.use(express.json()); 

/* ROUTES */
app.use('/api', adminTeamsRoute); 
app.use('/api', adminPrelimsRoute); 
app.use('/api', adminSemisRoute);

app.use('/api', adminAuthRoutes);
app.use('/api', adminOralRoutes); 
app.use('/api', adminWrittenRoutes);
app.use('/api', judgeOralRoundsRoutes);
app.use('/api', participantRoutes);
app.use('/api', writtenJudgesRoutes)
app.use('/api', writtenMemorandaScoresRoutes);
app.use('/api', writtenMemorandaLinksRoutes);
app.use('/api', oralJudgesRoutes);

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