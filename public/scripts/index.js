window.addEventListener("DOMContentLoaded", async () => {
    const usersList = document.querySelector("#users");
    let logged_in_user = await fetch(`http://${window.location.hostname}:${window.location.port}/user/logged_in`).then(async response => {
        let data = await response.json();
        return data;
    });


    fetch(`http://${window.location.hostname}:${window.location.port}/user/list`)
        .then(async (response) => {
            let users = await response.json();

            for (const user of users) {
                const listElement = document.createElement("li");
                listElement.textContent = user.name;

                if (!user.is_subscribed) {
                    const subscribeForm = document.createElement("form")
                    subscribeForm.id = `user_subscribe_${user.uuid}`;
                    subscribeForm.class = "user_subscribe";
                    subscribeForm.method = "post";
                    subscribeForm.action = `http://${window.location.hostname}:${window.location.port}/user/subscribe`

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
                    let response = await fetch(`http://${window.location.hostname}:${window.location.port}/channel/list?host=${user.uuid}`);
                    let channels = await response.json();

                    const channelList = document.createElement("ul");
                    for (const channel of channels) {
                        const channelListElement = document.createElement("li");
                        channelListElement.textContent = channel.name;
                        channelListElement.style.display = "inline-block";
                        channelListElement.style.margin = "0 10px";
                        channelList.appendChild(channelListElement);
                    }
                    listElement.appendChild(channelList);
                }

                usersList.appendChild(listElement);
            }
        });

    const channelList = document.querySelector("#channels");
    fetch(`http://${window.location.hostname}:${window.location.port}/channel/list?host=${logged_in_user.uuid}`)
        .then(async (response) => {
            let channels = await response.json();

            console.log("Channels ===> ", channels);
            for (const channel of channels) {
                const channelElemet = document.createElement("li");
                channelElemet.textContent = channel.name;
                channelList.appendChild(channelElemet);
            }
        })

});