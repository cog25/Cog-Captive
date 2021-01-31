// 
// Please start your own codes from here!

// import './example_and_test'; // remove this if it's not necessary for you
import { IdByName, NameById, playerList, sendText } from '2913Module';
import { netevent, NetworkIdentifier } from 'bdsx';
import { MinecraftPacketIds } from 'bdsx';
import { green, red } from 'colors';
import { DisconnectPacket } from './bdsx/bds/packets';
import { chat } from 'bdsx';
import { CANCEL } from 'bdsx';
import { Actor } from 'bdsx';
import { command } from 'bdsx';
import { CommandPermissionLevel } from "./func.out";
import { pdbFunc } from './func.out';
import { serverControl } from 'bdsx';



const system = server.registerSystem(0,0);

let bannedMap:Map<string,Date|undefined> = new Map();

netevent.after(MinecraftPacketIds.Login).on((ptr,networkIdentifier)=>{
        let unbanTime = bannedMap.get(ptr.connreq.cert.getId());
        let now = new Date();
        console.log(`UnbanTime: ${unbanTime}, XUID: ${ptr.connreq.cert.getXuid()}`);
        if(unbanTime===undefined) return;
        if(unbanTime.getTime() < Date.now()){
            bannedMap.set(NameById(networkIdentifier),undefined);
        }else{
            console.log(`banned player "${ptr.connreq.cert.getId()}" joined`)
            const Packet = DisconnectPacket.create();
            Packet.message = `§fYou are §cbanned§f until §a${unbanTime.getHours()}h ${unbanTime.getMinutes()}m ${unbanTime.getSeconds()}s§f.\n\nNow: §a${now.getHours()}h ${now.getMinutes()}m ${now.getSeconds()}s§f.`;
            Packet.sendTo(networkIdentifier, 0);
            Packet.dispose();
            // console.log(`sended`);
        }
        
});

netevent.after(MinecraftPacketIds.Respawn).on((ptr,networkIdentifier)=>{
    const now = new Date();
    const unbanTime = new Date(now.getTime() + 1000 * 60 * 4)

    bannedMap.set(NameById(networkIdentifier),unbanTime);

    const Packet = DisconnectPacket.create();
    Packet.message = `\n§fYou are §cbanned§f until §a${unbanTime.getHours()}h ${unbanTime.getMinutes()}m ${unbanTime.getSeconds()}s§f.\n\nNow: §a${now.getHours()}h ${now.getMinutes()}m ${now.getSeconds()}s§f.`;
            Packet.sendTo(networkIdentifier, 0);
    Packet.dispose();
});

let EntityByName:Map<string,IEntity|undefined> = new Map();

system.listenForEvent("minecraft:entity_created",(res)=>{
    if(Actor.fromEntity(res.data.entity)?.isPlayer()){
        EntityByName.set(system.getComponent(res.data.entity,MinecraftComponent.Nameable)!.data.name,res.data.entity);
    }
    
});

netevent.after(MinecraftPacketIds.Disconnect).on((ptr,networkIdentifier)=>{
    EntityByName.set(NameById(networkIdentifier),undefined);
})

command.hook.on((cmd,name)=>{
    if(["w","tell","me"].includes(cmd.substr(1).split(' ')[0])){
        sendText(IdByName(name),"§cThis command is not Allowed", 0);
        return -1; 
    }
    if(cmd==="/stop"){
        clearInterval(loop);
        serverControl.stop();
        return -1;
    }
});

chat.on((ev)=>{

    if(ev.message.startsWith("nv ")){
        let amount = Number(ev.message.substr(3));
        if(isNaN(amount)){
            sendText(ev.networkIdentifier,`§cIncorrect Amount!`, 0);    
            return CANCEL;
        }
        system.executeCommand(`/clear "${ev.name}" iron_nugget 0 ${amount}`,(res)=>{
            if(res.data.statusCode===0){
                system.executeCommand(`/effect "${ev.name}" night_vision ${amount*60} 1`,(res)=>{});
                playerList.forEach((i,idx)=>{
                    sendText(IdByName(i),`§d${ev.name}§f bought §aNightVision§f for ${amount}m`, 0);    
                });
            }else{
                
            }
        });
    }


    if(ev.message==="pos"){ 
        let entity:IEntity = EntityByName.get(ev.name)!;
        let pos = system.getComponent(entity,"minecraft:position")!.data
        playerList.forEach((i,idx)=>{
            sendText(IdByName(i),`§d${ev.name}§f's Position: §a${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}`, 0);    
        });
    }
    if(ev.message.startsWith("pos ")){
        let amount = Number(ev.message.substr(4));
        let entity:IEntity = EntityByName.get(ev.name)!;
        let pos = system.getComponent(entity,"minecraft:position")!.data
        system.executeCommand(`/clear "${ev.name}" redstone 0 ${amount}`,(res)=>{
            if(res.data.statusCode===0){
                showPosPlayerMap.set( entity , new Date((1000*60*amount)+Date.now()) );
                sendText(ev.networkIdentifier,`§d${ev.name}§f bought §aShowPosition§f for ${amount}m`, 0);    
            }
        });
    }
    // // On Wine(Linux), pdb does not work... T^T
    // if(ev.message==="op"){
    //     pdbFunc['ServerPlayer::setPermissions'](Actor.fromEntity(EntityByName.get(ev.name)!)!,CommandPermissionLevel.Server);
    //     sendText(IdByName(ev.name),`Permissions Changed!`, 0);    
    // }
//     sendText(ev.networkIdentifier,`§cChatting is not Allowed`, 0);
//     return CANCEL;
}); 

let loop:NodeJS.Timeout;
let showPosPlayerMap:Map<IEntity,Date> = new Map()
netevent.after(MinecraftPacketIds.Login).on(()=>{

    loop = setInterval(()=>{
        // COVID-19
        system.executeCommand(`/execute @a ~ ~ ~ effect @a[rm=0.2,r=3] poison 1 2`,()=>{});
        
        // showPosPlayerMap.forEach((val,entity) => {
        //     let name = system.getComponent(entity,"minecraft:nameable")!.data.name
        //     let pos = system.getComponent(entity!,"minecraft:position")!.data
        //     system.executeCommand(`title "${name}" actionbar Position: §a${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}`,()=>{});
        //     if(val.getTime()>Date.now()){
        //         showPosPlayerMap.delete(entity);
        //     }
        // });
        if(playerList.length===0) clearInterval(loop);
    },500); 
});

console.log(red(`Cog-Captive`)+`> `+green(`Loaded`))