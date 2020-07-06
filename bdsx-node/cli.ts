/**
 * This script will copy to package/pkg/index.js
 */

import request = require('request');
import fs_ori = require('fs');
import unzipper = require('unzipper');
import { sep } from 'path';
import path = require('path');
import { Writer } from 'fstream';
import readline = require('readline');
import version = require('./gen/version.json');
import pkg = require("./package.json");

try
{
    require('source-map-support/register');
}
catch (err)
{
}

// async
function async<T, THIS, PARAMS extends any[]>(genfunc:(this:THIS, ...params:PARAMS)=>Generator<Promise<any>, T, any>):(...params:PARAMS)=>Promise<T>
{
    return function (this:THIS){
        const gen:Generator<Promise<any>, T, any> = genfunc.apply(this, arguments);
        return new Promise<T>((resolve, reject)=>{
            function rejected(err:any)
            {
                next(gen.throw(err));
            }
            function fufilled(value?:any)
            {
                next(gen.next(value!));
            }
            function next(prom:IteratorResult<Promise<any>, T>, value?:any)
            {
                if (prom.done)
                {
                    resolve(prom.value);
                }
                else
                {
                    prom.value.then(fufilled, rejected).catch(reject);
                }
            }
            fufilled();
        });
    };
}

// fs
const fs = {
    readFile(path:string):Promise<string>
    {
        return new Promise((resolve, reject)=>{
            fs_ori.readFile(path, 'utf-8', (err, data)=>{
                if (err) reject(err);
                else resolve(data);
            });
        });
    },
    writeFile(path:string, content:string):Promise<void>
    {
        return new Promise((resolve, reject)=>{
            fs_ori.writeFile(path, content, (err)=>{
                if (err) reject(err);
                else resolve();
            });
        });
    },
    readdir(path:string):Promise<string[]>
    {
        return new Promise((resolve, reject)=>{
            fs_ori.readdir(path, 'utf-8', (err, data)=>{
                if (err) reject(err);
                else resolve(data);
            });
        });
    },
    mkdir(path:string):Promise<void>
    {
        return new Promise((resolve, reject)=>{
            fs_ori.mkdir(path, (err)=>{
                if (err) reject(err);
                else resolve();
            });
        });
    },
    rmdir(path:string):Promise<void>
    {
        return new Promise((resolve, reject)=>{
            fs_ori.rmdir(path, (err)=>{
                if (err) reject(err);
                else resolve();
            });
        });
    },
    stat(path:string):Promise<fs_ori.Stats>
    {
        return new Promise((resolve, reject)=>{
            fs_ori.stat(path, (err, data)=>{
                if (err) reject(err);
                else resolve(data);
            });
        });
    },
    unlink(path:string):Promise<void>
    {
        return new Promise((resolve, reject)=>{
            fs_ori.unlink(path, (err)=>{
                if (err) reject(err);
                else resolve();
            });
        });
    },
        
    exists(path:string):Promise<boolean>
    {
        return fs.stat(path).then(()=>true, ()=>false);
    },
};

// yesno
const yesno = function({ question, defaultValue }:{question:string, defaultValue?:boolean}) {
    function invalid (){
        process.stdout.write('\nInvalid Response.\n');
        process.stdout.write('Answer either yes : (' + yesValues.join(', ')+') \n');
        process.stdout.write('Or no: (' + noValues.join(', ') + ') \n\n');
    }

    const yesValues = [ 'yes', 'y'];
    const noValues  = [ 'no', 'n' ];

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise(function (resolve, reject) {
        rl.question(question + ' ', async(function*(answer) {
            rl.close();

            const cleaned = answer.trim().toLowerCase();
            if (cleaned == '' && defaultValue != null)
                return resolve(defaultValue);
    
            if (yesValues.indexOf(cleaned) >= 0)
                return resolve(true);
                
            if (noValues.indexOf(cleaned) >= 0)
                return resolve(false);
    
            invalid();
            const result = yield yesno({ question, defaultValue });
            resolve(result);
        }));
    });
};

// globals
const homedir:string = require('os').homedir();
const BDS_VERSION = version.BDS_VERSION;
const BDSX_VERSION = pkg.version;
const BDS_ZIP_NAME = `bedrock-server-${BDS_VERSION}.zip`;
const BDS_LINK = `https://minecraft.azureedge.net/bin-win/${BDS_ZIP_NAME}`;
const EMINUS_INFO_URL = `https://api.github.com/repos/karikera/elementminus/releases/latest`;
const BDS_DIR = `${homedir}${sep}.bds`;
const EXE_NAME = `bedrock_server.exe`;
const USER_AGENT = 'nodebs/1.0';
const INSTALL_INFO_PATH = `${BDS_DIR}${sep}installinfo.json`;
const MOD_DIR = `${BDS_DIR}${sep}mods`;

enum ExitCode
{
    DO_NOTHING,
    ERROR,
    RUN_BDS,
}

interface InstallInfo
{
    bdsVersion:string;
    bdsxVersion:string;
    eminusVersion:string;
    files:string[];
}

const KEEPS = new Set([
    `${sep}whitelist.json`,
    `${sep}valid_known_packs.json`,
    `${sep}server.properties`,
    `${sep}permissions.json`,
]);

const readInstallInfo = async(function*(){
    try
    {
        const file = yield fs.readFile(INSTALL_INFO_PATH);
        return JSON.parse(file);
    }
    catch (err)
    {
        if (err.code !== 'ENOENT') throw err;
        const iinfo:InstallInfo = require('./ii_unknown.json');;

        if (sep !== '/')
        {
            iinfo.files = iinfo.files.map(file => file.replace(/\//g, sep));
        }
        return iinfo;
    }
});

class MessageError extends Error
{
    constructor(msg:string)
    {
        super(msg);
    }
}

function wget(url:string):Promise<string>
{
    return new Promise((resolve, reject)=>{
        request({
            url,
            headers:{'User-Agent': USER_AGENT},
        }, (error, resp, body)=>{
            if (error) return reject(error);
            resolve(body);
        });
    });
}

interface GitHubInfo
{
    version:string;
    url:string;
}
const wgetGitHubInfo = async(function*(url:string){
    const latest = JSON.parse(yield wget(url));
    return {
        version: latest.tag_name,
        url: latest.assets[0].browser_download_url
    }
});

const readFiles = async(function*(root:string){
    const out:string[] = [];
    const _readFiles = async(function*(path:string){
        const proms:Promise<void>[] = [];
        for (const file of <string[]>(yield fs.readdir(root+path)))
        {
            const stat:fs_ori.Stats = yield fs.stat(file);
            if (!stat.isDirectory())
            {
                out.push(`${path}${sep}${file}`);
                continue;
            }
            else
            {
                out.push(`${path}${sep}${file}${sep}`);
                proms.push(_readFiles(`${path}${sep}${file}`));
            }
        }
        yield Promise.all(proms);
    });
    yield _readFiles(root);
    return out;
});

const rmdirRecursive = async(function*(path:string, filter:(path:string)=>boolean=()=>true){
    const files = yield fs.readdir(path);
    const filecount = files.length;
    if (filecount === 0)
    {
        yield fs.rmdir(path);
        return;
    }
    if (path.endsWith(sep)) path = path.substr(0, path.length-1);

    const proms = files.map(async(function*(file:string){
        const filepath = `${path}${sep}${file}`;
        if (!filter(filepath)) return;
        const stat:fs_ori.Stats = yield fs.stat(file);
        if (stat.isDirectory())
        {
            yield rmdirRecursive(filepath);
        }
        else
        {
            yield fs.unlink(filepath);
        }
    }));
    yield Promise.all(proms);
    yield fs.rmdir(path);
});

const concurrencyLoop = async(function*<T>(array:T[], concurrency:number, callback:(entry:T)=>Promise<void>){
    if (concurrency <= 1)
    {
        for (const entry of array)
        {
            yield callback(entry);
        }
    }
    else
    {
        const waitings = new Set<Promise<void>>();
        let errored:Error|null = null;
        for (const entry of array)
        {
            while (waitings.size >= concurrency)
            {
                yield Promise.race(waitings);
                if (errored) throw errored;
            }
            const prom = callback(entry).then(
                ()=>waitings.delete(prom), 
                err=>{
                errored = err;
            });
            waitings.add(prom);
        }
        yield Promise.all(waitings);
    }
});

function unzipBdsxTo(dest:string):Promise<void>
{
    return fs_ori.createReadStream(`${__dirname}${sep}bdsx-bin.zip`)
    .pipe(unzipper.Extract({ path: dest }))
    .promise();
}
const downloadAndUnzip = async(function*(url:string, dest:string, skipExists:boolean) {
    const archive:unzipper.CentralDirectory = yield unzipper.Open.url(request as any, url);
    const writedFiles:string[] = [];

    const files:unzipper.File[] = [];
    for (const file of archive.files)
    {
        let filepath = file.path;
        if (sep !== '/') filepath = filepath.replace(/\//g, sep);
        if (!filepath.startsWith(sep)) filepath = sep+filepath;
        writedFiles.push(filepath);

        if (skipExists)
        {
            try
            {
                const stat = yield fs.stat(BDS_DIR+filepath);
                if (!stat.isDirectory()) continue;
            }
            catch (err)
            {
            }
            files.push(file);
        }
    }

    if (skipExists)
    {
        yield concurrencyLoop(files, 5, async(function*(entry:unzipper.File){
            if (entry.type == 'Directory') return;
            var extractPath = path.join(dest, entry.path);
            if (extractPath.indexOf(dest) != 0) return;
            var writer = Writer({ path: extractPath });
            yield new Promise((resolve, reject)=>{
                entry.stream()
                    .on('error',reject)
                    .pipe(writer)
                    .on('close',resolve)
                    .on('error',reject);
            });
        }));
    }
    else
    {
        yield archive.extract({
            path: dest,
            concurrency: 5,
            verbose: true,
        });
    }
    return writedFiles;
});

const removeInstalled = async(function*(files:string[]){
    for (let i=files.length - 1;i>=0;i--)
    {
        const file = files[i];
        if (file.endsWith(sep))
        {
            try
            {
                yield fs.rmdir(BDS_DIR+file.substr(0, file.length-1));
            }
            catch (err)
            {
            }
        }
        else
        {
            try
            {
                yield fs.unlink(BDS_DIR+file);
            }
            catch (err)
            {
            }
        }
    }
});

const downloadBDS = async(function*(installinfo:InstallInfo, agree?:boolean){
    try
    {
        yield fs.mkdir(BDS_DIR);
    }
    catch (err)
    {
        if (err.code !== 'EEXIST') throw err;
    }
    if (yield fs.exists(`${BDS_DIR}${sep}${EXE_NAME}`)) 
    {
        yield update(installinfo);
        return;
    }
    console.log(`It will download and install Bedrock Dedicated Server to '${BDS_DIR}'`);
    console.log(`BDS Version: ${BDS_VERSION}`);
    console.log(`Minecraft End User License Agreement: https://account.mojang.com/terms`);
    console.log(`Privacy Policy: https://go.microsoft.com/fwlink/?LinkId=521839`);

    if (!agree)
    {
        const ok = yield yesno({
            question: "Would you like to agree it?(Y/n)"
        });
        if (!ok) throw new MessageError("Canceled");
    }
    else
    {
        console.log("Agreed by -y");
    }

    console.log(`BDS: Install to ${BDS_DIR}`);
    const writedFiles = yield downloadAndUnzip(BDS_LINK, BDS_DIR, true);
    installinfo.bdsVersion = BDS_VERSION;
    installinfo.files = writedFiles.filter(file=>!KEEPS.has(file));

    // eminus
    console.log(`Element Minus: Install to ${BDS_DIR}`);
    const eminusInfo = yield wgetGitHubInfo(EMINUS_INFO_URL);
    yield downloadAndUnzip(eminusInfo.url, BDS_DIR, false);
    installinfo.eminusVersion = eminusInfo.version;
    yield fs.mkdir(MOD_DIR);

    // bdsx
    console.log(`BDSX-mod: Install to ${MOD_DIR}`);
    yield unzipBdsxTo(MOD_DIR);
    installinfo.bdsxVersion = BDSX_VERSION;

    console.log(`BDSX: Done`);
});


const update = async(function*(installinfo:InstallInfo){
    console.log(`BDSX: Check update`);
    let updated = false;
    if (installinfo.bdsVersion === BDS_VERSION)
    {
        console.log(`BDS: Latest (${BDS_VERSION})`);
    }
    else
    {
        console.log(`BDS: Old (${installinfo.bdsVersion})`);
        console.log(`BDS: Install to ${BDS_DIR}`);
        yield removeInstalled(installinfo.files);
        const writedFiles = yield downloadAndUnzip(BDS_LINK, BDS_DIR, true);
        installinfo.bdsVersion = BDS_VERSION;
        installinfo.files = writedFiles.filter(file=>!KEEPS.has(file));
        updated = true;
    }
    
    // element minus
    const eminusInfo = yield wgetGitHubInfo(EMINUS_INFO_URL);
    if (installinfo.eminusVersion === eminusInfo.version)
    {
        console.log(`Element Minus: Latest (${eminusInfo.version})`);
    }
    else
    {
        console.log(`Element Minus: Old (${installinfo.eminusVersion})`);
        console.log(`Element Minus: Install to ${BDS_DIR}`);
        yield downloadAndUnzip(eminusInfo.url, BDS_DIR, false);
        installinfo.eminusVersion = eminusInfo.version;
        updated = true;
    }
    try
    {
        yield fs.mkdir(MOD_DIR);
    }
    catch (err)
    {
    }

    // bdsx
    if (installinfo.bdsxVersion === BDSX_VERSION)
    {
        console.log(`BDSX-mod: Latest (${BDSX_VERSION})`);
    }
    else
    {
        console.log(`BDSX-mod: Old (${installinfo.bdsxVersion})`);
        console.log(`BDSX-mod: Install to ${MOD_DIR}`);
        yield unzipBdsxTo(MOD_DIR);
        installinfo.bdsxVersion = BDSX_VERSION;
        updated = true;
    }

    if (updated) console.log(`BDSX: Updated`);
    else console.log(`BDSX: Latest`);
});


interface ArgsOption
{
    command?:string;
    command_next?:string;
    yes?:boolean;
    example?:string;
}
function parseOption():ArgsOption
{
    const option:ArgsOption = {};

    for (let i=2;i<process.argv.length;i++)
    {
        const arg = process.argv[i];
        if (arg.startsWith('-'))
        {
            switch (arg.substr(1))
            {
            case 'y': option.yes = true; break;
            }
            continue;
        }
        if (!option.command)
        {
            if (/^[a-zA-Z]/.test(arg))
            {
                option.command = arg;
                continue;
            }
        }
        else
        {
            option.command_next = arg;
            continue;
        }
    }
    return option;
}


async(function*(){
    try
    {
        let removing = false;
        const installinfo = yield readInstallInfo();
        try
        {
            const option = parseOption();
            switch (option.command)
            {
            case 'i':
            case 'install':
                yield downloadBDS(installinfo, option.yes);
                return ExitCode.DO_NOTHING;
            case 'r':
            case 'remove':
                removing = true;
                if (yield fs.exists(BDS_DIR))
                {
                    if (!option.yes)
                    {
                        const ok = yield yesno({
                            question: "BDSX: It will remove worlds and addons. Are you sure?(Y/n)"
                        });
                        if (!ok) throw new MessageError("Canceled");
                    }
                    console.log(`${BDS_DIR}: Removing`);
                    yield rmdirRecursive(BDS_DIR);
                    console.log(`${BDS_DIR}: Removed`);
                }
                else
                {
                    console.log(`${BDS_DIR}: Not found`);
                }
                return ExitCode.DO_NOTHING;
            case 'example':
                if (!option.command_next)
                {
                    console.error(`bdsx example ./path/to/example`);
                    return ExitCode.DO_NOTHING;
                }
                const example_path = path.resolve(option.command_next);
                console.log(`${example_path}: Unzip example`);
                const archive:unzipper.CentralDirectory = yield unzipper.Open.file(__dirname +'/bdsx-example.zip');
                yield archive.extract({path: example_path});
                console.log(`${example_path}: Done`);
                return ExitCode.DO_NOTHING;
            default:
                break;
            }
        
            yield downloadBDS(installinfo);
            return ExitCode.RUN_BDS;
        }
        finally
        {
            if (!removing)
            {
                yield fs.writeFile(INSTALL_INFO_PATH, 
                    JSON.stringify(installinfo, null, 4));
            }
        }
    }
    catch (err)
    {
        if (err instanceof MessageError)
        {
            console.error(err.message);
        }
        else
        {
            console.error(err);
        }
    }
    return ExitCode.DO_NOTHING;
})().then(exitCode=>{
    process.exit(exitCode);
});
