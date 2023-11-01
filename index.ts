import "chromedriver"
import webdriver, { Browser } from "selenium-webdriver"
import { Options } from "selenium-webdriver/chrome.js";

const options = new Options()

options.excludeSwitches("disable-component-update")
options.addArguments("--log-level=3", "--mute-audio", "--no-sandbox", "--disable-dev-shm-usage")

if (process.env.NODE_ENV === 'development') {
    require('dotenv').config();
}

const args = {
    users: process.env.USERS.split(';').map((user) => user.split(':')),
    target: process.env.TARGET,
    skip: process.env.SKIP ? parseInt(process.env.SKIP) : 0
}

const waitForPageLoad = async (driver: webdriver.WebDriver) => {
    await driver.wait(async () => {
        const readyState = await driver.executeScript('return document.readyState');
        return readyState === 'complete';
    });
}

const start = async (user: string[]) => {
    const driver = new webdriver.Builder().forBrowser(Browser.CHROME).setChromeOptions(options).build();
    driver.get("https://google.com/search?q=spotify")
    driver.get(`https://accounts.spotify.com/en/login?continue=${encodeURIComponent(args.target)}`)
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
                await driver.findElement(webdriver.By.css('button[aria-label="Next"]')).then((el) => { el.click() }, () => { })
            }
        }

        // wait 1 second
        await new Promise((resolve) => setTimeout(resolve, 1000))
    }
}

for (let user of args.users) {
    start(user)
}