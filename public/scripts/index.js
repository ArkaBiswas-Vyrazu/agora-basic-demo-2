window.addEventListener("DOMContentLoaded", async () => {
    const APP_ID = "";
    const client = AgoraRTC.createClient({ mode: "live", codec: "h264" });
    const screenClient = AgoraRTC.createClient({ mode: "live", codec: "vp8", role: "host" }) // For screen recording

    const AGORA_CHAT_APP_KEY = ""
    const AGORA_CHAT_HOST = "";
    const AGORA_CHAT_ORG_NAME = "";
    const AGORA_CHAT_APP_NAME = "";
    WebIM.conn = new WebIM.connection({ appKey: AGORA_CHAT_APP_KEY });

    let screenUID = null;
    let screenTrack = null;
    let chatGroupId = null;
    let chatUserId = null;
    let chatAppToken = null;
    let chatUserToken = null;
    let chatGroupHost = false; // Horrible idea, but should work for now
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
        try {
            // Reference: https://docs.agora.io/en/agora-chat/restful-api/user-system-registration?platform=web#registering-a-user
            // Required values retrieved from Agora Console

            // REST API Auth Tokens
            chatAppToken = await fetch("/agora/chat/token/create/app", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user: (role === "host" && !force) ? host : user })
            }).then(async response => {
                let data = await response.json();
                return data.token;
            });

            console.log(chatAppToken);
            // Need to look into hiding this, this is way too sensitive !!!!
            let checkUserExists = await fetch(`https://${AGORA_CHAT_HOST}/${AGORA_CHAT_ORG_NAME}/${AGORA_CHAT_APP_NAME}/users/${logged_in_user.name}`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${chatAppToken}`
                }
            }).then(async response => {
                let data = await response.json();
                return data;
            }).catch(err => {
                console.error("Error encountered while trying to check if user exists ===> ", err);
            });

            // This should always be the case, but in case it isn't, we should look
            // into the security of the chat sdk, considering we are revealing everything
            // here...
            if (checkUserExists.count !== 1 && !checkUserExists.entities) {
                console.log("Attempting to register new user")
                console.log(checkUserExists);

                // Registering user if user does not exist
                // let registerResponse = await fetch(
                    // `https://${AGORA_CHAT_HOST}/${AGORA_CHAT_ORG_NAME}/${AGORA_CHAT_APP_NAME}/users`,
                //     {
                //         method: "POST",
                //         headers: {
                //             Authorization: `Bearer ${chatAppToken}`,
                //             body: JSON.stringify({ username: logged_in_user.name }),
                //             "Content-Type": "application/json"
                //         }
                //     }).then(async response => {
                //         let data = await response.json();
                //         return data;
                //     })

                // let registerResponse = await fetch(
                //     "/agora/chat/register/user",
                //     {
                //         method: "POST",
                //         headers: {
                //             "Content-Type": "application/json"
                //         },
                //         body: JSON.stringify({ username: logged_in_user.name, token: chatAppToken })
                //     }
                // ).then(async response => {
                //     let data = await response.json();
                //     return data;
                // });

                let xhttp = new XMLHttpRequest();
                let registerResponse = null;

                xhttp.onreadystatechange = async () => {
                    console.log("xhttp request was updated ===> ", xhttp, xhttp.readyState, xhttp.status);
                    if (xhttp.readyState == XMLHttpRequest.DONE && xhttp.status == 200) {
                        registerResponse = xhttp.responseText;
                        console.log("Got a response ====> ", registerResponse);
                        chatUserId = JSON.parse(registerResponse).entities[0].uuid;
                        if (chatUserId == null) throw new Error("Chat User ID has ultimately resulted in null even after registration..... ===> ", registerResponse, chatUserId);
                        else console.log(`Received chat user ID: ${chatUserId}`);
                    }
                }
                xhttp.open("POST", `https://${AGORA_CHAT_HOST}/${AGORA_CHAT_ORG_NAME}/${AGORA_CHAT_APP_NAME}/users`);
                xhttp.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
                xhttp.setRequestHeader("Authorization", `Bearer ${chatAppToken}`);
                xhttp.send(JSON.stringify({ username: logged_in_user.name }));
            } else {
                chatUserId = await Promise.resolve(checkUserExists.entities[0].uuid);
                if (chatUserId == null) throw new Error("Chat User ID has ultimately resulted in null.....");
                else console.log(`Received chat user ID: ${chatUserId}`);
            }

            let chatButton = null;
            // Registration could take time, so we set a timeout until we receive a valid chatUserId
            if (chatUserId == null || chatUserId == '') {
                setTimeout(async () => {
                    if (chatUserId == null || chatUserId == '') throw new Error("Chat User ID has ultimately resulted in null.......", chatUserId);
                    else {
                        // SDK APIs Auth Token
                        chatUserToken = await fetch("/agora/chat/token/create/user", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            // body: JSON.stringify({ user: chatUserId })
                            body: JSON.stringify({ user: logged_in_user.name })
                        }).then(async response => {
                            let data = await response.json();
                            return data.token;
                        });
                        console.log("Chat User Token After Registration ===> ", chatUserToken);

                        chatButton = await openChatConnection(chatUserToken, role, host, channel, user);
                        if (chatButton instanceof HTMLButtonElement) controls.appendChild(chatButton);
                        else throw new Error("Did not receive a chat button ===> ", chatButton);
                    }
                },
                    "2500");
            } else {
                // SDK APIs Auth Token
                chatUserToken = await fetch("/agora/chat/token/create/user", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    // body: JSON.stringify({ user: chatUserId })
                    body: JSON.stringify({ user: logged_in_user.name })
                }).then(async response => {
                    let data = await response.json();
                    return data.token;
                });
                console.log("Chat User Token ===> ", chatUserToken);

                // await WebIM.conn.open({
                //     // user: (role === "host" && !force) ? host : user,
                //     user: logged_in_user.name,
                //     accessToken: await Promise.resolve(chatUserToken)
                // });

                chatButton = await openChatConnection(chatUserToken, role, host, channel, user);
                if (chatButton instanceof HTMLButtonElement) controls.appendChild(chatButton);
                else throw new Error("Did not receive a chat button ===> ", chatButton);
            }
        } catch (err) {
            console.error("Chat functionality was not implemented successfully ===> ", err);
        }
        /* ############################################################## */

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
                    } catch (err) { console.log("Error Encountered while trying to stop live streaming ====> ", err) };
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

        try {
            console.log("Deleting Chat Group ID ====> ", chatGroupId);
            if (chatGroupId) {
                if (chatGroupHost) {
                    await WebIM.conn.destroyGroup({ groupId: chatGroupId });
                    console.log("Successfully destroyed chat group");
                    chatGroupHost = false;
                } else {
                    await WebIM.conn.leaveGroup({ groupId: chatGroupId });
                    console.log("Successfully left chat group");
                }

                // Deleting the user as well
                fetch(
                    `https://${AGORA_CHAT_HOST}/${AGORA_CHAT_ORG_NAME}/${AGORA_CHAT_APP_NAME}/users/${logged_in_user.name}`,
                    {
                        method: "DELETE",
                        headers: {
                            Authorization: `Bearer ${chatAppToken}`
                        }
                    }
                ).then(response => response.json())
                    .then(data => console.log("Delete User response ===> ", data))
                    .catch(err => console.error("Error encountered while trying to delete user ===> ", err))
            }
        } catch (err) {
            console.error("Error encountered while trying to close chat ====> ", err);
        }

        document.querySelector("#streams").innerHTML = "";
        document.querySelector("#controls").remove();
        document.querySelector("#chat")?.remove();
    }

    async function openChatConnection(chatUserToken, role, host, channel, user) {
        await Promise.resolve(WebIM.conn.open({
            // user: (role === "host" && !force) ? host : user,
            user: logged_in_user.name,
            accessToken: await Promise.resolve(chatUserToken)
        }));

        await WebIM.conn.addEventHandler("connection&message", {
            onConnected: () => {
                const connSuccessMessage = document.createElement("li");
                connSuccessMessage.textContent = "User chat connection successful";
                document.querySelector("#list").appendChild(connSuccessMessage);
            },
            onDisconnected: () => {
                const connDisconnMessage = document.createElement("li");
                connDisconnMessage.textContent = "User chat disconnected";
                document.querySelector("#list").appendChild(connDisconnMessage);
            },
            onError: (err) => console.log("Chat Client Error ===> ", err),
            onTextMessage: (message) => {
                const messageElement = document.createElement("li");
                messageElement.textContent = `${message.from}: ${message.msg}`;
                document.querySelector("#messages").appendChild(messageElement);
            }
        });

        await WebIM.conn.addEventHandler("group", {
            onGroupEvent: function (msg) {
                const statusElement = document.createElement("li");
                switch (msg.operation) {
                    case "create":
                        statusElement.textContent = "Group Created Successfully!!";
                        console.log("Group Created Successfully ===> ", msg);
                        break;
                    case "destroy":
                        statusElement.textContent = "Group destroyed Successfully!!";
                        console.log("Group destroyed successfully ===> ", msg);
                        break;
                    default:
                        console.log("Chat Client handlerId event called ====> ", msg);
                        break;
                }
            }
        });


        if (role === "host") {
            const groupOptions = {
                data: {
                    groupname: `${host}_channel_${channel}_group`,
                    desc: `Chat Group for ${host} channel ${channel} live stream`,
                    members: [logged_in_user.name], // Need to account for remote users present (could use the client)
                    public: true,
                    approval: false,
                    allowinvites: false,
                    inviteNeedConfirm: false,
                    maxusers: 100
                }
            }

            const createGroupResult = await WebIM.conn.createGroup(groupOptions);
            console.log(`Chat group created successfully for host ====> `, createGroupResult, createGroupResult.data.groupid)
            chatGroupId = createGroupResult.data.groupid;
            chatGroupHost = true;
        } else {
            const chatGroup = await WebIM.conn.getPublicGroups({ limit: 1 }) // Assuming only one chat group is created per live stream
            console.log("Retrieved chat group ====> ", chatGroup.data);
            console.log("First chat group found ===> ", chatGroup.data[0]);

            chatGroupId = chatGroup.data[0].groupid;
            // Attempting audience join
            const audienceJoinResult = await WebIM.conn.joinGroup({
                groupId: chatGroupId,
                message: `${user} trying to join ${host} channel ${channel}`
            });

            console.log("Audience Join Result ===> ",
                audienceJoinResult.result,
                audienceJoinResult.user,
                audienceJoinResult.id,
                audienceJoinResult.action
            );
            if (!audienceJoinResult.result) console.log(`Reason for failure ===> `, audienceJoinResult.reason);
        }

        const chatButton = document.createElement("button");
        chatButton.id = "chat-button";

        const chatButtonImg = document.createElement("img");
        chatButtonImg.src = "/assets/chat.png";
        chatButtonImg.style.height = "15px";
        chatButtonImg.style.maxWidth = "auto";
        chatButtonImg.style.marginTop = "2%";
        chatButton.appendChild(chatButtonImg);

        chatButton.addEventListener("click", async (event) => {
            let chat = document.querySelector("#chat");
            if (!chat) {
                chat = document.createElement("div");
                chat.id = "chat";
                chat.style.backgroundColor = "rgb(59, 53, 53)";
                chat.style.height = "90vh";
                chat.style.width = "25vw";

                const messages = document.createElement("ul");
                messages.id = "messages";
                chat.appendChild(messages);

                const sendMessageForm = document.createElement("form");
                const messageInput = document.createElement("input");
                messageInput.type = "text";
                messageInput.placeholder = "Send message to all";
                messageInput.name = "message";
                sendMessageForm.appendChild(messageInput);
                const messageSubmitButton = document.createElement("button");
                messageSubmitButton.type = "submit";
                messageSubmitButton.value = "Send";
                sendMessageForm.appendChild(messageSubmitButton);
                sendMessageForm.addEventListener("submit", async (event) => {
                    event.preventDefault();
                    if (!chatGroupId) throw new Error("Chat Group Id is null ===> ", chatGroupId);

                    const options = {
                        chatType: "groupChat",
                        type: "txt",
                        deliverOnlineOnly: true,
                        to: chatGroupId,
                        msg: event.target.elements.message.value
                    }

                    const msg = await WebIM.message.create(options);
                    WebIM.conn.send(msg)
                        .then((res) => console.log("Send message success ===> ", res))
                        .catch((e) => console.log("Send message fail ===> ", e));
                })
                chat.appendChild(sendMessageForm);

                document.querySelector("#stream-main-container").appendChild(chat);
            } else chat.remove();
        });

        return chatButton;
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