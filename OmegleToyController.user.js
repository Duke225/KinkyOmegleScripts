// ==UserScript==
// @name         Omegle Toy Controller
// @namespace    http://sedim.me/
// @version      0.1
// @description  Allows the Stranger to control your sex toys.
// @author       Duke225
// @downloadURL  https://duke225.github.io/KinkyOmegleScripts/OmegleToyController.user.js
// @match        https://www.omegle.com/
// @connect      lovense.club
// @connect      lovense.com
// @grant        unsafeWindow
// @run-at       document-body
// ==/UserScript==

(function() {
    'use strict';

    // Create events
    const EVENT_MESSAGE_RECEIVED = 'message_received';
    const EVENT_MESSAGE_SENT = 'message_sent';
    const EVENT_CHAT_END = 'chat_end';
    const EVENT_CHAT_START = 'chat_start';

    // Lovense
    const toys = [];
    function getToys() {
        return fetch("https://api.lovense.com/api/lan/getToys", {mode:"cors"})
            .then(res => {
            return res.json();
        }).then(data => {
            for(const hostUrl in data) {
                const host = data[hostUrl];
                const baseUrl = `https://${host.domain}:${host.httpsPort}`;
                for (const toyId in host.toys) {
                    const toy = host.toys[toyId];
                    console.log(toy);
                    toys.push({
                        id: toyId,
                        name: toy.nickName ? toy.nickName : toy.name,
                        type: toy.type,
                        baseUrl
                    });
                }
            }
            return toys;
        });
    }

    let currentPulse;
    function pulseToys(level = 1, duration = 1000) {
        return Promise.resolve(currentPulse).then((e) => {
            console.log(`${new Date().toISOString()}: Vibrating toys at speed ${level}/20 for ${duration}ms.`);
            currentPulse = new Promise(resolve => {
                const startRequests = [];
                toys.forEach(toy => {
                    startRequests.push(fetch(`${toy.baseUrl}/Vibrate?v=${level}&t=${toy.id}`));
                });
                resolve(Promise.all(startRequests));
            }).then(() => {
                return new Promise(resolve => {
                    setTimeout(resolve, duration);
                });
            }).then(() => {
                const stopRequests = [];
                toys.forEach(toy => {
                    stopRequests.push(fetch(`${toy.baseUrl}/Vibrate?v=0&t=${toy.id}`));
                });
                return Promise.all(stopRequests);
            });
            return currentPulse;
        }).catch(console.log);
    }

    getToys()
        .then(toys => { console.log('Fetched toy list', toys); })
        .then(() => { pulseToys(1, 500); })
        .catch(console.log);

    // Message Handlers
    function handlePleasure(msg) {
        const match = e.detail.match(/^!pleasure\s*([0-9]+)?\s*([0-9]+)?\s*$/i);
        console.log('message match', match);
        if (match) {
            pulseToys(parseInt(match[1]) || 1, match[2] ? parseInt(match[2]) * 1000 : 1000);
        }
    }

    // Add listeners
    window.addEventListener(EVENT_MESSAGE_RECEIVED, (e) => {
        console.log(`Their message: ${e.detail}`);
        if (e.detail.startsWith('!pleasure')) {
            handlePleasure(e.detail);
        }
    });
    window.addEventListener(EVENT_MESSAGE_SENT, (e) => {
        console.log(`Your message: ${e.detail}`);
        if (e.detail.startsWith('!pleasure')) {
            handlePleasure(e.detail);
        }
    });
    window.addEventListener(EVENT_CHAT_START, (e) => { console.log('Chat started.'); });
    window.addEventListener(EVENT_CHAT_END, (e) => { console.log('Chat ended.'); });

    // Observers
    function observeChatLog (logbox) {
        const chatMutation = new MutationObserver(e => {
            e.forEach(record => {
                record.addedNodes.forEach(node => {
                    try {
                        if (node.children[0].classList.contains('strangermsg')) {
                            // Msg received
                            const msg = node.children[0].innerText.replace('Stranger: ','');
                            window.dispatchEvent(
                                new CustomEvent(EVENT_MESSAGE_RECEIVED, { target: node, detail: msg })
                            );
                        } else if (node.children[0].classList.contains('youmsg')) {
                            // Msg Sent
                            const msg = node.children[0].innerText.replace('You: ','');

                            window.dispatchEvent(
                                new CustomEvent(EVENT_MESSAGE_SENT, { target: node, detail: msg })
                            );
                        } else if (node.children[0].classList.contains('statuslog')) {
                            if (node.children[0].innerText === 'Stranger has disconnected.') {
                                // Chat ends
                                window.dispatchEvent(new CustomEvent(EVENT_CHAT_END, { target: node }));
                            } else if (node.children[0].innerText === "You're now chatting with a random stranger. Say hi!") {
                                // Chat begins
                                window.dispatchEvent(new CustomEvent(EVENT_CHAT_START, { target: node }));
                            }
                        }
                    } catch (err) {
                        console.log(`Error: ${err.stack? err.stack : err}`);
                    }
                });
            });
        });
        chatMutation.observe(logbox, { childList: true });
    }

    const bodyMutation = new MutationObserver(e => {
        try {
            const chatboxWasAdded = e.reduce((result, record) => {
                return result || (record.addedNodes[0] && record.addedNodes[0].classList && record.addedNodes[0].classList.contains('chatbox3'));
            }, false);
            if (chatboxWasAdded) {
                const newLog = document.getElementsByClassName('logbox')[0].children[0];
                observeChatLog(newLog);
            }
        } catch (err) {
            console.log(`Error: ${err.stack? err.stack : err}`);
        }
    });

    bodyMutation.observe(document.getElementsByTagName('body')[0], { childList: true});
})();
