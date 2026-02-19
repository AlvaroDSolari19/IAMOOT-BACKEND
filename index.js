require('dotenv').config(); 
const express = require('express'); 
const cors = require('cors');
const { Dropbox } = require ('dropbox'); 
const { connectToMongoDB } = require('./db'); 

const loginRoute = require('./routes/login');
const adminTeamsRoute = require('./routes/adminTeams');
const adminPrelimsRoute = require('./routes/adminPrelims'); 
const adminSemisRoute = require('./routes/adminSemis')
const judgeOralRoundsRoutes = require('./routes/judgeOralRounds');
const loginWrittenRoute = require('./routes/loginWritten');

const app = express(); 
const port = process.env.PORT || 3000; 

/* DROPBOX SETUP */
const dbx = new Dropbox({ accessToken: process.env.DROPBOX_ACCESS_TOKEN });

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

app.get('/health', (req, res) => {
    res.json({ ok: true });
})

async function startServer(){
    await connectToMongoDB();
    app.listen(port, () => console.log(`Server is running on port ${port}`));
}

startServer().catch( (err) => {
    console.error(`Server failed to start: ${err}`);
    process.exit(1); 
})