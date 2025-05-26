const eventSource = new EventSource(`/agora/events`, { withCredentials: true });
eventSource.onmessage = (event) => {
    const newElement = document.createElement("li");
    newElement.textContent = event.data;
    document.querySelector("#list").appendChild(newElement);
}

eventSource.onerror = (err) => {
    console.error("EventSource failed: ", err);
}

window.onbeforeunload = () => eventSource.close();
