import "chromedriver"
import webdriver, { Browser } from "selenium-webdriver"
import { Options } from "selenium-webdriver/chrome.js";
import { readFileSync, writeFileSync,existsSync } from "fs";

import express from "express"

const options = new Options()

let globalIterator = 0
const globalState: {
    [key: string]: SessionState,
} = {
}

export type Song = {
    title: string,
    artist: string,
    coverImageUrl?: string,
}

export type SessionState = {
    username: string,
    currentSong: Song,
    streams: number,
    playbackTime: number, // seconds
    target: string,
}

options.excludeSwitches("disable-component-update")
options.addArguments(
    "--log-level=3",
    "--mute-audio",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--window-size=1280x1024"
)

if (process.env.NODE_ENV === 'development') {
    require('dotenv').config();
}

const args = {
    users: [],
    skip: 35,
    port: process.env.PORT || 8080,
}

if(existsSync("users.json")){
    // json is [{username,password}], convert it to [[username,password]]
    args.users = JSON.parse(readFileSync("users.json").toString()).map((user: {
        username: string,
        password: string,
    }) => [user.username, user.password])
}else{
    if(process.env.USERS) {
        args.users = process.env.USERS.split(";").map((user) => user.split(":"))
    }
    writeFileSync("users.json", JSON.stringify(args.users.map((user)=> ({
        username: user[0],
        password: user[1],
    }))))
}

const waitForPageLoad = async (driver: webdriver.WebDriver) => {
    await driver.wait(async () => {
        const readyState = await driver.executeScript('return document.readyState');
        return readyState === 'complete';
    });
}

const start = async (user: string[], target: string, sessionId: number) => {
    globalState[sessionId] = {
        username: user[0],
        currentSong: {
            title: "",
            artist: "",
        },
        streams: 0,
        playbackTime: 0,
        target
    }

    const driver = new webdriver.Builder().forBrowser(Browser.CHROME).setChromeOptions(options).build();
    driver.get("https://google.com/search?q=spotify")
    await waitForPageLoad(driver)
    driver.get(`https://accounts.spotify.com/en/login?continue=${encodeURIComponent(target)}`)
    await waitForPageLoad(driver)
    const email = await driver.findElement(webdriver.By.id("login-username"))
    const password = await driver.findElement(webdriver.By.id("login-password"))
    const submit = await driver.findElement(webdriver.By.id("login-button"))
    await email.sendKeys(user[0])
    await password.sendKeys(user[1])
    await submit.click()
    await waitForPageLoad(driver)
    // wait for accept cookies button to appear
    await driver.wait(webdriver.until.elementLocated(webdriver.By.id("onetrust-accept-btn-handler")))
    await driver.sleep(3000)
    // accept cookies
    await driver.findElement(webdriver.By.id("onetrust-accept-btn-handler")).click()
    await driver.sleep(2000)

    // wait for playback button to appear
    await driver.wait(webdriver.until.elementLocated(webdriver.By.css('button[data-encore-id="buttonPrimary"]')))

    while (1) {
        // click unchecked shuffle button
        await driver.findElement(webdriver.By.css('button[aria-label="Enable shuffle"][aria-checked="false"]')).then((el) => { el.click() }, () => { })
        // click unchecked repeat button
        await driver.findElement(webdriver.By.css('button[aria-label="Enable repeat"][aria-checked="false"]')).then((el) => { el.click() }, () => { })
        // open now playing widget
        await driver.findElement(webdriver.By.css('button[data-testid="control-button-npv"][aria-pressed="false"]')).then((el)=>{el.click()}, ()=>{})

        // start playback if not playing button data-testid="play-button" aria-label="Play Ja" data-encore-id="buttonPrimary" 
        await driver.findElement(webdriver.By.xpath('(.//button[@data-encore-id="buttonPrimary"][@data-testid="play-button"])[2]')).then((el) => {
            el.getAttribute("aria-label").then((label) => {
                if (label.startsWith("Play")) {
                    el.click()
                }
            })
        }, () => { })

        // unmute if muted
        await driver.findElement(webdriver.By.css('button[aria-label="Unmute"]')).then((el) => el.click(), () => { })

        if (args["skip"] > 0) {
            // check playback progress
            const progress = await driver.findElement(webdriver.By.className('playback-bar__progress-time-elapsed')).then(async (el) => { return ((await el.getText()).split(":").map((e, i) => i == 0 ? parseInt(e) * 60 : parseInt(e))).reduce((partialSum, a) => partialSum + a, 0) }, () => { return 0 })
            if (progress > args["skip"]) {
                // skip to next song
                if(globalState[sessionId]) {
                    globalState[sessionId].streams++
                }
                await driver.findElement(webdriver.By.css('button[aria-label="Next"]')).then((el) => { el.click() }, () => { })
            }
        }

        // update to globalState
        const currentSong = await driver.findElement(webdriver.By.css('div[data-testid="now-playing-widget"]')).then(async (el) => {
            // [data-testid="now-playing-widget"]'s aria label is "Now playing: {title} by {artist}"
            const ariaLabel = await el.getAttribute("aria-label")
            const title = ariaLabel.split(" by ")[0].split(": ")[1]
            const artist = ariaLabel.split(" by ")[1]
            // coverImageUrl: aside[aria-label="Now Playing View"] img[data-testid="cover-art-image"]
            const coverImageUrl = await driver.findElement(webdriver.By.css('aside[aria-label="Now Playing view"] img[data-testid="cover-art-image"]')).then((el) => { return el.getAttribute("src") }, () => { return "" })
            return { 
                title, 
                artist,
                coverImageUrl,
            }
        }, () => { return { title: "", artist: "" } })
        // get playback time from progress bar
        const playbackTime = await driver.findElement(webdriver.By.className('playback-bar__progress-time-elapsed')).then(async (el) => { 
            return ((await el.getText()).split(":").map((e, i) => i == 0 ? parseInt(e) * 60 : parseInt(e))).reduce((partialSum, a) => partialSum + a, 0) 
        }, () => { return 0 })

        if(!globalState[sessionId]) {
            driver.quit()
            break
        }
        const username = user[0]
        const streams = globalState[sessionId] ? globalState[sessionId].streams : 0
        globalState[sessionId] = {
            username,
            currentSong,
            streams,
            playbackTime,
            target
        }
        console.log(`[${sessionId}] ${username} - ${currentSong.title} - ${currentSong.artist} - ${playbackTime} - ${streams}`)

        // wait 3 seconds
        await new Promise((resolve) => setTimeout(resolve, 3000))
    }
}

const app = express()

app.get("/", (req, res) => {
    res.json(globalState)
})

app.get("/session/:id", (req, res) => {
    const id = req.params.id
    if (globalState[id]) {
        res.json(globalState[id])
    } else {
        res.status(404).send("Session not found")
    }
})

app.get("/start/:type/:id", (req, res) => {
    const target = `/${req.params.type}/${req.params.id}`
    // check if target is /playlist|album|artist etc/id
    if (!target.match(/\/(playlist|album|artist|track)\/[a-zA-Z0-9]+/)) {
        res.status(400).send("Invalid target")
        return
    }

    const user = args.users.filter((user) => {
        // if used by an session in globalState, return false
        if (Object.values(globalState).filter((state) => state.username == user[0]).length > 0) {
            return false
        }
        return true
    })[0]
    if(!user) {
        res.status(400).send("No more users available")
        return
    }
    start(user, `https://open.spotify.com${target}`, globalIterator++)
    res.send(`Started session for ${user[0]}`)
})

// start multiple session
app.get("/multistart/:users/:type/:id", (req,res) => {
    const target = `/${req.params.type}/${req.params.id}`
    // check if target is /playlist|album|artist etc/id
    if (!target.match(/\/(playlist|album|artist|track)\/[a-zA-Z0-9]+/)) {
        res.status(400).send("Invalid target")
        return
    }

    
    //users is a count, if set to "available" it will use all available users
    const users = args.users.filter((user) => {
        // if used by an session in globalState, return false
        if (Object.values(globalState).filter((state) => state.username == user[0]).length > 0) {
            return false
        }
        return true
    })
    let threads: number
    if(req.params.users == "available") {
        threads = users.length
    }else {
        threads = parseInt(req.params.users)
    }
    if(threads > users.length) {
        threads = users.length
    }
    if(threads == 0) {
        res.status(400).send("No more users available")
        return
    }

    let i = 0
    const interval = setInterval(() => {
        if(i >= threads) {
            clearInterval(interval)
            res.send(`Started ${threads} sessions`)
            return
        }
        start(users[i], `https://open.spotify.com${target}`, globalIterator++)
        i++
    }, 1500)
    
    res.status(200).send(`Started ${threads} sessions`)
})

app.get("/users", (req, res) => {
    res.json(args.users.map((user) => {
        const sessionId = Object.keys(globalState).filter((key) => globalState[key].username == user[0])[0]
        return {
            username: user[0],
            sessionId,
        }
    }))
})

app.post("/useradd", (req, res) => {
    const username = req.query.username
    const password = req.query.password
    if (!username || !password) {
        res.status(400).send("Missing username or password")
        return
    }
    args.users.push([username, password])
    writeFileSync("users.json", JSON.stringify(args.users.map((user)=> ({
        username: user[0],
        password: user[1],
    }))))
    res.send("User added")
})

app.get("/users/:username", (req, res) => {
    const username = req.params.username
    const user = args.users.filter((user) => user[0] == username)[0]
    if(!user) {
        res.status(404).send("User not found")
        return
    }
    const session = Object.values(globalState).filter((state) => state.username == username)[0]
    res.json({
        username,
        session,
    })
})

app.get("/stop/:id", (req, res) => {
    const id = req.params.id
    if (globalState[id]) {
        delete globalState[id]
        res.send("Session stopped")
    } else {
        res.status(404).send("Session not found")
    }
})

app.get("/stopall", (req, res) => {
    Object.keys(globalState).forEach((key) => {
        delete globalState[key]
    })
    res.send("All sessions stopped")
})

app.listen(args.port, () => {
    console.log(`Listening on port ${args.port}`)
})