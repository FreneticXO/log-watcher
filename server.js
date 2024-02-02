const express = require('express');
const app = express();
const socketio = require('socket.io');
const fs = require('fs');
require('dotenv').config();

const file_name = "logs.txt";

const port = process.env.PORT || 3000;
const server = require('http').createServer(app);
const io = socketio(server);


var endOfFile = 0;

function emitLogs(text, socketID) {

    let date = new Date();
    date = date.toISOString();
    io.to(socketID).emit('new log', date + ":  " + text);
}

function broadcastLog(text) {

    let date = new Date();
    date = date.toISOString();
    io.emit('new log', date + ":  " + text);

}


function tailFile(filePath, numLines) {
    const CHUNK_SIZE = 1024; // Adjust the chunk size as needed
    const buffer = Buffer.alloc(CHUNK_SIZE);
    const lines = [];

    const fd = fs.openSync(filePath, 'r');
    let bytesRead;
    let currentPosition = fs.statSync(filePath).size;
    endOfFile = currentPosition;

    while (lines.length < numLines && currentPosition > 0) {
        const bytesRead = fs.readSync(fd, buffer, 0, CHUNK_SIZE, currentPosition - CHUNK_SIZE);
        const chunkLines = buffer.toString('utf-8', 0, bytesRead).split('\n').reverse();

        for (let i = 0; i < chunkLines.length && lines.length < numLines; i++) {
            const line = chunkLines[i].trim();
            if(line != '') {
                lines.push(line);
            }
            // currentPosition -=  new Blob([chunkLines[i]]).size;
        }
        currentPosition -= bytesRead;
        
    }

    fs.closeSync(fd);

    console.log(`Last ${numLines} lines of ${filePath} (read from bottom to top):`);
    return lines;

}


function tailFileNewLines(filePath, currentPosition) { 
    const CHUNK_SIZE = 1024;
    const buffer = Buffer.alloc(CHUNK_SIZE);
    const lines = [];

    const fd = fs.openSync(filePath, 'r');

    let lastPosition = fs.statSync(filePath).size;

    while(currentPosition < lastPosition) {

        console.log(`current position is: ${currentPosition}`);
        console.log(`last position is: ${lastPosition}`);

        const bytesRead = fs.readSync(fd, buffer, 0, lastPosition - currentPosition, currentPosition);
        const chunkLines = buffer.toString('utf-8', 0, bytesRead).split('\n').reverse();

        for(let i = 0; i < chunkLines.length; i++) {
            const line = chunkLines[i].trim();
            if(line != '') {
                lines.push(line);
            }
        }

        currentPosition += bytesRead;
        endOfFile = currentPosition;
    }

    fs.closeSync(fd);

    console.log(`Last ${lines.length} lines of ${filePath} (new lines):`);

    return lines;

}


server.listen(port, () => {
    console.log(`Listening on port ${port}`);
});

app.get('/logs', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
})


fs.watchFile(file_name, {interval: 10}, (curr, prev) => {
    console.log('The File was modified');    
    
    const lines = tailFileNewLines(file_name, endOfFile);
    lines.reverse();
    lines.forEach((line) => {
        broadcastLog(line);
    })
    
})


io.on('connection', (socket) => {


    const lines = tailFile(file_name, 10);
    lines.reverse();
    lines.forEach((line) => {
        emitLogs(line, socket.id)
    })

    console.log("User connected with ID: " + socket.id);

})