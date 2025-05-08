window.addEventListener("DOMContentLoaded", async () => {
    const APP_ID = "839346d06e0b46298c3468d4bf7c3505";
    const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
    let remoteUsers = {};

    const usersList = document.querySelector("#users");
    let logged_in_user = await fetch(`/user/logged_in`).then(async response => {
        let data = await response.json();
        return data;
    });

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

                // This part never works..... beacuse Agora does not allow device changed in an active stream
                // client.onMicrophoneChanged = async (info) => {
                //     console.log("Microphone was either removed or changed");
                //     if (info.status === "ACTIVE") {
                //         await micTrack.setDevice(info.device.deviceId);

                //         document.querySelector("#mic")?.remove();
                //         const micButton = document.createElement("button");
                //         micButton.id = "mic";
                //         micButton.textContent = "Mic On";
                //         micButton.addEventListener("click", async (event) => {
                //             if (localTracks[0].muted) {
                //                 await localTracks[0].setMuted(false);
                //                 event.target.textContent = "Mic On";
                //                 event.target.style.backgroundColor = "cadetblue"
                //             } else {
                //                 await localTracks[0].setMuted(true);
                //                 event.target.textContent = "Mic Off";
                //                 event.target.style.backgroundColor = "#e9e9ed";
                //             }
                //         });

                //         document.querySelector("#controls")?.append(micButton);

                //         alert(`Microphone ${info.device.label} has been connected successfully`);
                //     }
                // }

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

        // controls.append(leaveButton, micButton, cameraButton);
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
        document.querySelector("#streams").innerHTML = "";
        document.querySelector("#controls").remove();
    }

    async function handleUserJoined(user, mediaType) {
        remoteUsers[user.uid] = user;
        console.log("A new user joined ===> ", user.uid);
        await client.subscribe(user, mediaType);
        console.log(`User ${user.uid} was subscribed successfully`);

        if (mediaType === "video") {
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
        }

        if (mediaType === "audio") user.audioTrack.play();
    }

    async function handleUserLeft(user) {
        delete remoteUsers[user.uid];
        document.querySelector(`#user_container_${user.uid}`).remove();
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