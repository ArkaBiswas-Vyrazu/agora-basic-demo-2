import { AgoraRTC } from "./agora.js";

window.addEventListener("DOMContentLoaded", async () => {
    const APP_ID = "839346d06e0b46298c3468d4bf7c3505";
    let token = null;

    let localTracks = [];
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

    fetch('/user/list').then(async (response) => await listUsers(response));

    async function getToken(host, channel, user=null, role="audience") {
        if (role !== "audience" && role !== "host") {
            throw new Error("Role Parameter can only be host or audience");
        }

        let token = await fetch(`/agora/token/${role}/create`, {
            method: "POST",
            options: {"Content-Type": "application/x-www-form-urlencoded"},
            body: new URLSearchParams({ host, user, channel })
        }).then(async response => {
            let data = await response.json();
            return data.token;
        });

        return token;
    }

    async function createLocalScreenTrack(channel, token) {
        const client = AgoraRTC.createClient({mode: "live", codec: "vp8", role: "host"});
        await client.join(APP_ID, channel, token, )
    }

    async function createLocalTracks(tracksConfig = {mic: true, cam: true, screen: false}) {
    }

});
