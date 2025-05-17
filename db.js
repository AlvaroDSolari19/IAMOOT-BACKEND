require('dotenv').config(); 
const { MongoClient } = require('mongodb');

/* MONGODB SETUP */
const client = new MongoClient(process.env.MONGODB_URI); 
let dbInstance = null; 

async function connectToMongoDB(){
    try {
        await client.connect(); 
        dbInstance = client.db(process.env.MONGODB_DB_NAME); 
        console.log('Connected to MongoDB Atlas'); 
    } catch (err){
        console.error('Failed to connect to MongoDB: ', err); 
    }
}

function getDb(){
    if(!dbInstance){
        throw new Error('Database not connected. Call connectToMongoDB() first.'); 
    }
    return dbInstance; 
}

function getCollection(collectionName){
    return getDb().collection(collectionName); 
}

module.exports = {
    connectToMongoDB, 
    getDb,
    getCollection, 
    client
}