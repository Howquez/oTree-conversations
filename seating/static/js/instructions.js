const submitButton = document.getElementById('submit_button');

submitButton.disabled = true;

setTimeout(() => {
    submitButton.disabled = false;
    submitButton.className = "btn btn-primary shadow"
}, 10000);
