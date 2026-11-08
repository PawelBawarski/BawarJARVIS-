function isTrustedSender(event, useBuiltUi) {
  const expectedOrigin = useBuiltUi
    ? "jarvis://app"
    : "http://127.0.0.1:4200";

  return Boolean(
    event?.senderFrame &&
    event.sender?.mainFrame === event.senderFrame &&
    event.senderFrame.origin === expectedOrigin
  );
}

module.exports = { isTrustedSender };
