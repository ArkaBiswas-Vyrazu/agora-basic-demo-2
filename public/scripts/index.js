window.addEventListener("DOMContentLoaded", async () => {
    const APP_ID = "839346d06e0b46298c3468d4bf7c3505";
    const client = AgoraRTC.createClient({ mode: "live", codec: "h264" });
    const screenClient = AgoraRTC.createClient({ mode: "live", codec: "vp8", role: "host" }) // For screen recording

    let screenUID = null;
    let screenTrack = null;
    let localTracks = [];
    let remoteUsers = {};

    const usersList = document.querySelector("#users");
    let logged_in_user = await fetch(`/user/logged_in`).then(async response => {
        let data = await response.json();
        return data;
    });

    // screenClient.on("user-published", async (user, mediaType) => {
    //     console.log('user-published was called on screenClient ===> ', user);
    //     await handleUserJoined(user, mediaType, true)
    // });

    async function listUsers(response) {
        let users = await response.json();

        for (const user of users) {
            const listElement = document.createElement("li");
            listElement.textContent = user.name;

            if (!user.is_subscribed) {
                const subscribeForm = document.createElement("form")
                subscribeForm.id = `user_subscribe_${user.uuid}`;
                subscribeForm.class = "user_subscribe";
                subscribeForm.method = "post";
                subscribeForm.action = `/user/subscribe`

                const hostInputElement = document.createElement("input");
                hostInputElement.type = "hidden";
                hostInputElement.name = "host";
                hostInputElement.value = user.uuid;

                const subscriberInputElement = document.createElement("input")
                subscriberInputElement.type = "hidden";
                subscriberInputElement.name = "subscriber";
                subscriberInputElement.value = logged_in_user.uuid;

                const submitButton = document.createElement("button")
                submitButton.type = "submit";
                submitButton.textContent = "Subscribe";

                subscribeForm.appendChild(hostInputElement);
                subscribeForm.appendChild(subscriberInputElement);
                subscribeForm.appendChild(submitButton);

                listElement.appendChild(subscribeForm);
            } else {
                let response = await fetch(`/channel/list?host=${user.uuid}`);
                let channels = await response.json();

                const channelList = document.createElement("ul");
                for (const channel of channels) {
                    const channelListElement = document.createElement("li");
                    channelListElement.style.display = "inline-block";
                    channelListElement.style.margin = "0 10px";

                    const channelForm = document.createElement("form");

                    const channelHiddenHostInput = document.createElement("input");
                    channelHiddenHostInput.type = "hidden";
                    channelHiddenHostInput.name = "host";
                    channelHiddenHostInput.value = user.uuid;

                    const channelHiddenChannelInput = document.createElement("input");
                    channelHiddenChannelInput.type = "hidden";
                    channelHiddenChannelInput.name = "channel";
                    channelHiddenChannelInput.value = channel.name;

                    const channelHiddenUserInput = document.createElement("input");
                    channelHiddenUserInput.type = "hidden";
                    channelHiddenUserInput.name = "user";
                    channelHiddenUserInput.value = logged_in_user.uuid;

                    const channelButton = document.createElement("button");
                    channelButton.type = "submit"
                    channelButton.textContent = channel.name;

                    channelForm.append(channelHiddenHostInput, channelHiddenChannelInput, channelHiddenUserInput, channelButton);
                    channelForm.addEventListener("submit", async (event) => {
                        event.preventDefault();

                        // To test if this is working, swap the host and user values, and set role to "host"
                        await joinAndDisplayStream(
                            event.target.elements.host.value,
                            event.target.elements.user.value,
                            event.target.elements.channel.value,
                            "audience",
                        );
                    })

                    channelListElement.appendChild(channelForm);
                    channelList.appendChild(channelListElement);
                }
                listElement.appendChild(channelList);
            }

            usersList.appendChild(listElement);
        }
    }

    async function createLocalTracks() {
        let micTrack = null;
        let cameraTrack = null;

        try {
            micTrack = await AgoraRTC.createMicrophoneAudioTrack() || null;
            if (micTrack) micTrack.on("track-ended", () => {
                alert("Microphone was disconnected");
                document.querySelector("#mic")?.remove();

            });
        } catch (err) {
            micTrack = null;
        }

        try {
            cameraTrack = await AgoraRTC.createCameraVideoTrack() || null;
            if (cameraTrack) cameraTrack.on("track-ended", () => {
                alert("Camera was diconnected");
                document.querySelector("#camera")?.remove();
            });
        } catch (err) {
            cameraTrack = null;
        }

        localTracks = [micTrack, cameraTrack];
        return [micTrack, cameraTrack];
    }

    async function joinAndDisplayStream(host, user, channel, role, force = false) {
        let streams = document.querySelector("#streams");
        if (streams.innerHTML !== "") {
            alert("A stream is currently running");
            throw new Error("A stream is currently running");
        }

        client.on("user-published", handleUserJoined);
        client.on("user-left", handleUserLeft);

        console.log("Attempting Stream Joining ===> ", host, user, channel, role)
        // Reference: https://stackoverflow.com/questions/35325370/how-do-i-post-a-x-www-form-urlencoded-request-using-fetch
        let token = await fetch(`/agora/token/${role}/create`, {
            method: "POST",
            options: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ host, user, channel })
        }
        ).then(async response => {
            let data = await response.json()
            return data.token;
        });

        if (role === "host") await client.setClientRole("host");
        else await client.setClientRole("audience", { level: 1 });

        await client.join(APP_ID, channel, token, (role === "host" && !force) ? host : user);
        localTracks = await createLocalTracks();

        let playerContainer = document.createElement("div");
        playerContainer.className = "video_container";
        playerContainer.id = `user_container_${(role === "host") ? host : user}`;
        let playerContainerPlayer = document.createElement("div");
        playerContainerPlayer.className = "video_player";
        playerContainerPlayer.id = `user_${(role === "host") ? host : user}`;
        playerContainer.appendChild(playerContainerPlayer);
        streams.appendChild(playerContainer);

        const streamWrapper = document.querySelector("#stream-wrapper");
        const controls = document.createElement("div");
        controls.id = "controls";
        controls.style.display = "flex";

        const leaveButton = document.createElement("button");
        leaveButton.id = "leave";
        leaveButton.textContent = "Leave Stream";
        leaveButton.addEventListener("click", leaveAndRemoveLocalStream);
        controls.appendChild(leaveButton);

        if (role === "host") {
            screenTrack = null;
            let screenToken = null;

            const screenRecordButton = document.createElement("button");
            screenRecordButton.id = "record";
            const screenRecordButtonImg = document.createElement("img");
            screenRecordButtonImg.src = "/assets/video-solid.svg";
            screenRecordButtonImg.style.height = "15px";
            screenRecordButtonImg.style.maxWidth = "auto";
            screenRecordButton.appendChild(screenRecordButtonImg);
            screenRecordButton.addEventListener("click", async (event) => {
                if (screenTrack === null) {
                    try {
                        screenTokenAndUID = (
                            screenToken ||
                            await fetch(`/agora/token/host/create`, {
                                method: "POST",
                                options: { "Content-Type": "application/x-www-form-urlencoded" },
                                body: new URLSearchParams({ host, channel, screen_token: true })
                            }).then(async response => {
                                let data = await response.json()
                                return data;
                            })
                        );
                        screenUID = screenTokenAndUID.generated;
                        screenToken = screenTokenAndUID.token;

                        screenClient.on("user-published", async (user, mediaType) => {
                            console.log('user-published was called on screenClient ===> ', user);
                            await handleUserJoined(user, mediaType, true)
                        });

                        screenUID = await screenClient.join(APP_ID, channel, screenToken, screenUID);
                        screenTrack = await AgoraRTC.createScreenVideoTrack({ encoderConfig: "1080p_1" });

                        const streamPlayerContainer = document.createElement("div");
                        streamPlayerContainer.className = "video_container";
                        streamPlayerContainer.id = `user_stream_container_${screenUID}`;
                        let streamPlayerContainerPlayer = document.createElement("div");
                        streamPlayerContainerPlayer.className = "video_container";
                        streamPlayerContainerPlayer.id = `user_stream_${screenUID}`;
                        streamPlayerContainer.appendChild(streamPlayerContainerPlayer);
                        document.querySelector("#streams").appendChild(streamPlayerContainer);

                        screenTrack.play(`user_stream_${screenUID}`);
                        await screenClient.publish(screenTrack);
                    } catch (err) {
                        if (screenTrack) {
                            await screenTrack.stop()
                            await screenTrack.close();
                            await screenClient.unpublish(screenTrack);
                        }
                        screenTrack = null;
                        await screenClient.leave();
                        document.querySelector(`#user_stream_container_${screenUID}`)?.remove();
                        screenUID = null;
                        screenToken = null;
                        console.log("Error encountered when trying to start screen record ===> ", err);
                    }
                } else {
                    await screenTrack.stop()
                    await screenTrack.close();
                    await screenClient.unpublish(screenTrack);
                    screenTrack = null;
                    await screenClient.leave();
                    document.querySelector(`#user_stream_container_${screenUID}`)?.remove();
                    screenUID = null;
                    screenToken = null;
                }
            });
            controls.appendChild(screenRecordButton);
        }

        if (localTracks[0]) {
            const micButton = document.createElement("button")
            micButton.id = "mic";

            // micButton.textContent = "Mic On";
            const micButtonImg = document.createElement("img");
            micButtonImg.src = "/assets/microphone-solid.svg";
            micButtonImg.style.height = "15px";
            micButtonImg.style.maxWidth = "auto";
            micButton.appendChild(micButtonImg);

            micButton.addEventListener("click", async (event) => {
                console.log(event);

                if (localTracks[0].muted) {
                    await localTracks[0].setMuted(false);
                    if (event.target.src) event.target.src = "/assets/microphone-solid.svg";
                    if (event.target.firstChild) event.target.firstChild.src = "/assets/microphone-solid.svg";
                } else {
                    await localTracks[0].setMuted(true);
                    if (event.target.src) event.target.src = "/assets/microphone-slash-solid.svg";
                    if (event.target.firstChild) event.target.firstChild.src = "/assets/microphone-slash-solid.svg";
                }
            });
            controls.appendChild(micButton);
        }

        if (localTracks[1]) {
            const cameraButton = document.createElement("button");
            cameraButton.id = "camera";
            // cameraButton.textContent = "Camera On";

            const cameraButtonImg = document.createElement("img");
            cameraButtonImg.src = "/assets/cam.png";
            cameraButtonImg.style.height = "15px";
            cameraButtonImg.style.maxWidth = "auto";
            cameraButtonImg.style.marginTop = "2%";
            cameraButton.appendChild(cameraButtonImg);

            cameraButton.addEventListener("click", async (event) => {
                if (localTracks[1].muted) {
                    await localTracks[1].setMuted(false);
                    // event.target.textContent = "Camera On";
                    // event.target.style.backgroundColor = "cadetblue";
                    if (event.target.src) event.target.src = "/assets/cam.png";
                    if (event.target.firstChild) event.target.firstChild.src = "/assets/cam.png";
                } else {
                    await localTracks[1].setMuted(true);
                    // event.target.textContent = "Camera Off";
                    // event.target.style.backgroundColor = "#e9e9ed";
                    if (event.target.src) event.target.src = "/assets/cam-off.png";
                    if (event.target.firstChild) event.target.firstChild.src = "/assets/cam-off.png";
                }
            })
            controls.appendChild(cameraButton);
        }

        /* ################### Chat Functionality ####################### */
        // const chatButton = document.createElement("button");
        // chatButton.id = "chat-button";

        // const chatButtonImg = document.createElement("img");
        // chatButtonImg.src = "/assets/chat.png";
        // chatButtonImg.style.height = "15px";
        // chatButtonImg.style.maxWidth = "auto";
        // chatButtonImg.style.marginTop = "2%";
        // chatButton.appendChild(chatButtonImg);

        // const chatClient = new AgoraChat.Connection({appKey:  APP_ID});
        // chatClient.addEventHandler("connection&message", {
        //     onConnected: () => {
        //         const connSuccessMessage = document.createElement("li");
        //         connSuccessMessage.textContent = "User chat connection successful";
        //         document.querySelector("#list").appendChild(connSuccessMessage);
        //     },
        //     onDisconnected: () => {
        //         const connDisconnMessage = document.createElement("li");
        //         connDisconnMessage.textContent = "User chat disconnected";
        //         document.querySelector("#list").appendChild(connDisconnMessage);
        //     },
        //     onError: (err) => console.log("Chat Client Error ===> ", err),
        //     onTextMessage: (message) => {
        //         const messageElement = document.createElement("li");
        //         messageElement.textContent = `${message.from}: ${message.msg}`;
        //         document.querySelector("#messages").appendChild(messageElement);
        //     }
        // })

        // chatButton.addEventListener("click", async (event) => {
        //     let chat = document.querySelector("#chat");
        //     if (!chat) {
        //         await chatClient.open({
        //             user: (role === "host" && !force) ? host : user,
        //             accessToken: token
        //         });

        //         chat = document.createElement("div");
        //         chat.id = "chat";
        //         chat.style.backgroundColor = "rgb(59, 53, 53)";
        //         chat.style.height = "90vh";
        //         chat.style.width = "25vw";

        //         const messages = document.createElement("ul");
        //         messages.id = "messages";
        //         chat.appendChild(messages);

        //         const sendMessageForm = document.createElement("form");
        //         const messageInput = document.createElement("input");
        //         messageInput.type = "text";
        //         messageInput.placeholder = "Send message to all";
        //         messageInput.name = "message";
        //         sendMessageForm.appendChild(messageInput);
        //         const messageSubmitButton = document.createElement("button");
        //         messageSubmitButton.type = "submit";
        //         messageSubmitButton.value = "Send";
        //         sendMessageForm.appendChild(messageSubmitButton);
        //         sendMessageForm.addEventListener("submit", async (event) => {
        //             event.preventDefault();

        //             // Need to ask requirement
        //             const options = {
        //                 chatType: "groupChat", // or chatRoom

        //             }
        //         })

        //         document.querySelector("#stream-main-container").appendChild(chat);
        //     } else {
        //         chatClient.close();
        //         chat.remove();
        //     }
        // });

        // controls.appendChild(chatButton);
        /* ############################################################## */

        // controls.append(leaveButton, micButton, cameraButton);

        /* ################### Livestream Functionality ####################### */
        const liveStreamButton = document.createElement("button");
        liveStreamButton.id = "live-stream";

        const liveStreamButtonImg = document.createElement("img");
        liveStreamButtonImg.src = "/assets/upload-solid.svg";
        liveStreamButtonImg.style.height = "15px";
        liveStreamButtonImg.style.maxWidth = "auto";
        liveStreamButtonImg.style.marginTop = "2%";
        liveStreamButton.appendChild(liveStreamButtonImg);

        let liveStreamStatus = false;
        liveStreamButton.addEventListener("click", async (event) => {
            const url = `rtmp://localhost/live/${channel}`; // Test RTMP URL (Using nginx)
            console.log("RTMP URL ===> ", url);
            if (liveStreamStatus === false) {
                try {
                    await client.startLiveStreaming(url);
                    console.log(`Live stream successfully running at ${url}`);
                    liveStreamStatus = true;
                } catch (err) {
                    try {
                        await client.stopLiveStreaming(url);
                    } catch (err) {console.log("Error Encountered while trying to stop live streaming ====> ", err)};
                    liveStreamStatus = false;
                    console.log("Error Encountered while trying to start live stream ====> ", err);
                }
            } else {
                try {
                    await client.stopLiveStreaming(url);
                    console.log(`Live streaming at url ${url} successfully stopped`);
                    liveStreamStatus = false;
                } catch (err) {
                    liveStreamStatus = false;
                    console.log("Error encountered while trying to stop live streaming ====> ", err);
                }
            }
        });

        controls.appendChild(liveStreamButton);
        /* #################################################################### */


        streamWrapper.appendChild(controls);

        client.enableAudioVolumeIndicator();
        client.on("volume-indicator", volumes => {
            volumes.forEach((volume, index) => {
                console.log(`${index} UID ${volume.uid} ${volume.level}`)
                try {
                    const container = document.querySelector(`#user_container_${volume.uid}`);
                    if (container) {
                        if (volume.level >= 50) container.style.borderColor = "purple";
                        else container.style.borderColor = "black";
                    }
                } catch (err) {
                    console.log(err);
                }
            });

        })

        if (localTracks[1] !== null) {
            localTracks[1].play(`user_${(role === "host") ? host : user}`);
        } else {
            let image = document.createElement("img");
            image.src = "/assets/anon.webp";
            image.style.display = "flex";
            image.style.margin = "auto";
            image.style.borderRadius = "50%";
            playerContainerPlayer.style.display = "flex";
            playerContainerPlayer.appendChild(image);
        }
        if (role === "host") await client.publish(localTracks.filter(n => n));
    }

    async function leaveAndRemoveLocalStream(event) {
        for (let i = 0; i < localTracks.length; i++) {
            if (localTracks[i] !== null) {
                localTracks[i].stop();
                localTracks[i].close();
            } else localTracks.splice(i, 1);
        }

        if (localTracks) await client.unpublish(localTracks);
        await client.leave();

        if (screenTrack) {
            await screenTrack.stop();
            await screenTrack.close()
            await screenClient.unpublish(screenTrack);
            screenTrack = null;
            await screenClient.leave();
            screenUID = null;
            screenToken = null;
        }

        document.querySelector("#streams").innerHTML = "";
        document.querySelector("#controls").remove();
        document.querySelector("#chat")?.remove();
    }

    async function checkScreenUid(user) {
        let response = await fetch(`/agora/screen/check?uid=${user.uid}`)
            .then(async response => {
                let data = await response.json();
                return data;
            });
        return response.status;
    }

    async function handleUserJoined(user, mediaType = null, screen = false) {
        // console.log("Remote Users right now ===> ", remoteUsers);
        // console.log("Debug Info ====> ");
        // console.log("Remote user received ===> ", user, " - matches logged in user: ", user.uid === logged_in_user.uuid);
        // console.log("MediaType ===> ", mediaType);
        // console.log("User audio track ===> ", user.audioTrack, user.hasAudio);
        // console.log("User video track ===> ", user.videoTrack, user.hasVideo);

        if (!([user, mediaType] in remoteUsers) &&
            user.uid !== logged_in_user.uuid &&
            user.uid !== client.uid &&
            (screenUID === null || user.uid !== screenUID)) {

            // if (screen === true) console.log('This was triggered by screenClient user-published');

            remoteUsers[user.uid] = [user, mediaType];
            console.log("A new user joined ===> ", user.uid, mediaType);

            // console.log("Client Remote Users ===> ", client.remoteUsers);
            // console.log("Client Local Tracks ===> ", client.localTracks);
            // console.log("Screen Client Local Tracks ===> ", screenClient.localTracks);

            try {
                let status = await checkScreenUid(user);
                console.log(status);
                if (user.uid === screenUID || status || screen === false) {
                    await client.subscribe(user, mediaType);
                    console.log(`User ${user.uid} was subscribed successfully`);
                    if (mediaType === "video") {
                        if (screen !== true) {
                            console.log("Plain Execution");
                            let player = document.querySelector(`#user_container_${user.uid}`);
                            if (player) player.remove();

                            player = document.createElement("div");
                            player.className = "video_container";
                            player.id = `user_container_${user.uid}`;
                            let playerContainerPlayer = document.createElement("div");
                            playerContainerPlayer.className = "video_player";
                            playerContainerPlayer.id = `user_${user.uid}`;
                            player.appendChild(playerContainerPlayer);

                            let streams = document.querySelector("#streams");
                            streams.appendChild(player);

                            user.videoTrack.play(`user_${user.uid}`);
                        } else {
                            console.log("Stream Execution");
                            let player = document.querySelector(`#user_stream_container_${user.uid}`);
                            if (player) player.remove();

                            player = document.createElement("div");
                            player.className = "video_container";
                            player.id = `user_stream_container_${user.uid}`;
                            let playerContainerPlayer = document.createElement("div");
                            playerContainerPlayer.className = "video_player";
                            playerContainerPlayer.id = `user_stream_${user.uid}`;
                            player.appendChild(playerContainerPlayer);

                            document.querySelector("#streams").appendChild(player);
                            user.videoTrack.play(`user_stream_${user.uid}`);
                        }
                    }

                    if (mediaType === "audio") user.audioTrack.play();
                }
            } catch (err) {
                if (err.code === "INVALID_REMOTE_USER") console.log("Unknown user was encountered ====> ", user);
                else throw err;
            }
        }
    }

    async function handleUserLeft(user) {
        delete remoteUsers[user.uid];
        document.querySelector(`#user_container_${user.uid}`)?.remove();
    }

    fetch(`/user/list`)
        .then(async (response) => {
            await listUsers(response);
        });

    const channelList = document.querySelector("#channels");
    fetch(`/channel/list?host=${logged_in_user.uuid}`)
        .then(async (response) => {
            let channels = await response.json();
            if (channels.length === 0) {
                const channelElement = document.createTextNode("You didn't make any channels yet");
                channelList.appendChild(channelElement);
            } else {
                for (const channel of channels) {
                    const channelElemet = document.createElement("li");
                    channelElemet.textContent = channel.name;

                    const startStreamForm = document.createElement("form");

                    const startStreamHostInput = document.createElement("input");
                    startStreamHostInput.type = "hidden";
                    startStreamHostInput.name = "host";
                    startStreamHostInput.value = logged_in_user.uuid;

                    const startStreamChannelInput = document.createElement("input");
                    startStreamChannelInput.type = "hidden";
                    startStreamChannelInput.name = "channel";
                    startStreamChannelInput.value = channel.name;

                    const startStreamButton = document.createElement("button");
                    startStreamButton.type = "submit"
                    startStreamButton.textContent = "Start Stream";

                    startStreamForm.append(startStreamHostInput, startStreamChannelInput, startStreamButton);
                    startStreamForm.addEventListener("submit", async (event) => {
                        event.preventDefault();
                        await joinAndDisplayStream(
                            event.target.elements.host.value,
                            null,
                            event.target.elements.channel.value,
                            "host"
                        );
                    })

                    channelElemet.appendChild(startStreamForm);
                    channelList.appendChild(channelElemet);
                }
            }
        });
});