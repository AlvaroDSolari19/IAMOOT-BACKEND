const multer = require('multer'); 
const uploadStorage = multer.memoryStorage(); 

const uploadParticipantFiles = multer({
    storage: uploadStorage
});

const participantUploadMiddleware = uploadParticipantFiles.fields([
    { name: 'stateMemorandum', maxCount: 1 },
    { name: 'victimMemorandum', maxCount: 1}
]);

module.exports = participantUploadMiddleware; 