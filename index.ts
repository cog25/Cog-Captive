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
        serverControl.stop()
        return -1;
    }
});

chat.on((ev)=>{
    if(ev.message==="nv"){
        system.executeCommand(`/clear "${ev.name}" iron_ingot 0 1`,(res)=>{
            if(res.data.statusCode===0){
                system.executeCommand(`/effect "${ev.name}" night_vision 300 1`,(res)=>{});
                playerList.forEach((i,idx)=>{
                    sendText(IdByName(i),`§d${ev.name} used Night Vision`, 0);    
                });
            }
        }
    }
    if(ev.message==="pos"){
        system.executeCommand(`/clear "${ev.name}" compass 0 1`,(res)=>{
            let entity = EntityByName.get(ev.name);
            let pos = system.getComponent(entity!,"minecraft:position")!.data;
                
            if(!res.data.statusCode){
                sendText(IdByName(ev.name),`Your Position: §a${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}`, 0);    
            }else{
                playerList.forEach((i,idx)=>{
                    sendText(IdByName(i),`§d${ev.name}§f's Position: §a${pos.x.toFixed(2)} ${pos.y.toFixed(2)} ${pos.z.toFixed(2)}`, 0);    
                });
            }
            return CANCEL;
        })
    }
    // if(ev.message==="op"){
    //     pdbFunc['ServerPlayer::setPermissions'](Actor.fromEntity(EntityByName.get(ev.name)!)!,CommandPermissionLevel.Server);
    //     sendText(IdByName(ev.name),`Permissions Changed!`, 0);    
    // }
    sendText(IdByName(ev.name),`§cChatting is not Allowed`, 0);
    return CANCEL;
}); 

let covidLoop:NodeJS.Timeout;

netevent.after(MinecraftPacketIds.Login).on(()=>{
    covidLoop = setInterval(()=>{
        system.executeCommand(`/execute @a ~ ~ ~ effect @a[rm=0.01,r=3] poison 1 2`,()=>{});
        if(playerList.length===0) clearInterval(covidLoop);
    },500); 
});

console.log(red(`Cog-Captive`)+`> `+green(`Loaded`))