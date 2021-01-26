// https://github.com/minyee2913/bdsX-scripts/blob/main/example_and_test-BDSX2/2913Module.ts
// _______        _______    __     _____     ______    ___      ___                                                      ________          ___      __________   
// |      \      /      |   |__|    |    \    |    |    \  \    /  /    ___________     ___________       __________    _|        |__      /   |    |  ____    |
// |       \    /       |    __     |     \   |    |     \  \  /  /     |   _______|    |   _______|     |  ____    |   |           |     /_   |    |__|  |    | 
// |        \__/        |   |  |    |      \  |    |      \  \/  /      |  |_______     |  |_______      |__|   /   |   |_          |       |  |       ___|    | 
// |     |\      /|     |   |  |    |   |\  \ |    |       |    |       |   _______|    |   _______|           /   /      |______   |       |  |     _|___     |
// |     | \____/ |     |   |  |    |   | \  \|    |       |    |       |  |_______     |  |_______       ____/   /__            |  |    ___|  |__  |  |__|    |
// |_____|        |_____|   |__|    |___|  \_______|       |____|       |__________|    |__________|     |___________|           |__|   |_________| |__________|  
//
//
import { netevent, PacketId, command, NetworkIdentifier, createPacket, sendPacket, MinecraftPacketIds } from "bdsx";
import { ContainerOpenPacket, DisconnectPacket, ModalFormRequestPacket, SetHealthPacket, TextPacket, TransferPacket } from "bdsx/bds/packets";
const system = server.registerSystem(0,0);
const fs = require('fs');

let playerList:Array<string> = [];
let nIt = new Map();
let nMt = new Map();
let nXt = new Map();
netevent.after(PacketId.Login).on((ptr, networkIdentifier) => {
    const cert = ptr.connreq.cert;
    const xuid = cert.getXuid();
    const username = cert.getId();
    nXt.set(username, xuid);
    nIt.set(username, networkIdentifier);
    nMt.set(networkIdentifier, username);
    playerList.push(username);
});
netevent.close.on(networkIdentifier => {
    const id = nMt.get(networkIdentifier);
    nXt.delete(id);
    nMt.delete(networkIdentifier);
    nIt.delete(id);
    playerList.splice(playerList.indexOf(id),1);
});
/**
  *get playerXuid by Name
*/
function XuidByName(PlayerName: string) {
    let Rlt:any = nXt.get(PlayerName);
    return Rlt;
}
/**
  *get playerName by Id
*/
function NameById(networkIdentifier: NetworkIdentifier) {
    let Rlt:string = nMt.get(networkIdentifier);
    return Rlt;
}
/**
  *get playerId by Name
*/
function IdByName(PlayerName: string) {
    let Rlt:NetworkIdentifier = nIt.get(PlayerName);
    return Rlt;
}

/////////////////////////////////////////
//JSform

let FormDataSaver = new Map;
let FormDataloader = new Map;
function Formsend(networkIdentifier: NetworkIdentifier, form: object, handler = (data: any) => {}) {
    try {
        const modalPacket = ModalFormRequestPacket.create();
        let formId = Math.floor(Math.random() * 2147483647) + 1;
        modalPacket.setUint32(formId, 0x28);
        modalPacket.setCxxString(JSON.stringify(form), 0x30);
        modalPacket.sendTo(networkIdentifier, 0);
        FormDataSaver.set(formId, handler);
        FormDataloader.set(networkIdentifier, formId);
        modalPacket.dispose();
    } catch (err) {}
}
netevent.raw(PacketId.ModalFormResponse).on((ptr, size, networkIdentifier) => {
    let datas: {[key: string]: any} = {};
    ptr.move(1);
    datas.formId = ptr.readVarUint();
    datas.formData = ptr.readVarString();
    let dataValue = FormDataloader.get(networkIdentifier);
    if (datas.formId == dataValue) {
        let dataResult = FormDataSaver.get(dataValue);
        var data = JSON.parse(datas.formData.replace("\n",""));
        FormDataSaver.delete(dataValue);
        FormDataloader.delete(networkIdentifier);
        dataResult(data);
    }
});

/////////////////////////////////////////
//TEXT

function sendText(networkIdentifier: NetworkIdentifier, text: string, type: number) {
    const Packet = TextPacket.create();
    Packet.message = text;
    Packet.setUint32(type, 0x28);
    Packet.sendTo(networkIdentifier, 0);
    Packet.dispose();
}

/////////////////////////////////////////
//transferServer

function transferServer(networkIdentifier: NetworkIdentifier, address: string, port: number) {
    const Packet = TransferPacket.create();
    Packet.address = address;
    Packet.port = port;
    Packet.sendTo(networkIdentifier, 0);
    Packet.dispose();
}

/////////////////////////////////////////
//Health

function setHealth(networkIdentifier: NetworkIdentifier, value: number) {
    const HealthPacket = SetHealthPacket.create();
    HealthPacket.setInt32(value, 0x28);
    HealthPacket.sendTo(networkIdentifier, 0);
    HealthPacket.dispose();
};

/////////////////////////////////////////
//Permission

function playerPermission(playerName: string, ResultEvent = (perm: any) => {}) {
    var operJs;
    var permissions;
    operJs = JSON.parse(fs.readFileSync("permissions.json", "utf8"))
    var ojs = operJs.map((e:any, i:any) => e);
    ojs.forEach(function(element: any, index: any, array: any){
        if (element.xuid == nXt.get(playerName)) {
            permissions = element.permission;
        }
    });
    ResultEvent(permissions);
};

/////////////////////////////////////////
//Score

function getScore(targetName: string, objectives: string, handler = (result: any) => {}) {
    system.executeCommand(`scoreboard players add @p[name="${targetName}"] ${objectives} 0`, result => {
    // @ts-ignore
    let msgs = result.data.statusMessage;
    let msg = String(msgs).split('now', undefined);
    let a = String(msg[1]);
    let s = Number(a.replace(/[^0-9]/g, ''));
    handler(s);
    });
    return;
};

/////////////////////////////////////////
//Disconnect

function Disconnect(networkidentifier: NetworkIdentifier, message: string) {
    const Packet = DisconnectPacket.create();
    Packet.message = message;
    Packet.sendTo(networkidentifier, 0);
    Packet.dispose();
}

export { 
    Formsend,
    XuidByName,
    IdByName,
    NameById,
    sendText,
    transferServer,
    setHealth,
    playerPermission,
    getScore,
    playerList,
    Disconnect
};