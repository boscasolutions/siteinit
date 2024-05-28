const fs = require("fs");

const handlerObj = {
    "/": home,
    "/message": message
};

function home(res) {
    console.log("Executing 'home' handler");
    fs.readFile(__dirname + "/index.html", (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end(JSON.stringify(err));
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
    });
}

function message(res, payload) {
    console.log("Executing 'message' handler");
    let msg = new URLSearchParams(payload);
    let data = {
        pass: msg.get('pass'),
        apiKey: msg.get('apiKey'),
        siteName: msg.get('siteName'),
        net2IP: msg.get('net2IP'),
        net2ApiBaseUrl: msg.get('net2ApiBaseUrl'),
        net2ApiHubUrl: msg.get('net2ApiHubUrl'),
        net2User: msg.get('net2User'),
        net2Pass: msg.get('net2Pass'),
        net2ClientId: msg.get('net2ClientId'),
    };

    // require('child_process').exec('sudo /sbin/shutdown -r now', function (msg) { console.log(msg) });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

module.exports = { 
    home, 
    message,
    handlerObj
};


/*
Steps to up and run site:

1 - generate settings file
2 - register site
3 - reboot system

Preparation steps: 

1 - services should have run condition
2 - site run service should also have run conditions




sudo apt install nodejs -y
sudo apt install npm -y

*/