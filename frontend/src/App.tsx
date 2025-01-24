import { useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";

import "./App.css";
import { UUID } from "crypto";

type EventType =
  | "none"
  | "changeVideoUrl"
  | "play"
  | "pause"
  | "stop"
  | "seek"
  | "volume"
  | "mute"
  | "unmute";

interface IPlayerState {
  originalUrl?: string;
  embedUrl: string;
  eventType: EventType;
}

interface IUser {
  userId: UUID;
  name?: string;
  role?: "user" | "admin";
}

const connection = new signalR.HubConnectionBuilder()
  .withUrl("https://localhost:7054/notificationHub")
  .build();

function App() {
  const iframePlayerRef = useRef<HTMLIFrameElement | null>(null);

  const [currentUser, setCurrentUser] = useState<IUser | null>(null);

  const [usersConnected, setUsersConnected] = useState<IUser[]>([]);

  const [inputValue, setInputValue] = useState("");

  const [playerState, setPlayerState] = useState<IPlayerState>({
    originalUrl: "",
    embedUrl: "",
    eventType: "none",
  });

  const [oldValues, setOldValues] = useState(() => {
    const cached = localStorage.getItem("urlHistory");
    return cached ? JSON.parse(cached) : [];
  });
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    console.log(connection.state);

    connection.start().then(() => console.log("Connection started"));

    setCurrenUserInformation();

    connection.on(
      "ClientAllOnNewUserConnected",
      (listOfUsersConnected: IUser[]) => {
        console.table(listOfUsersConnected);
        setUsersConnected(listOfUsersConnected);
      }
    );

    connection.on("ClientsAllUpdatePlayerState", (message: string) => {
      const player = iframePlayerRef.current?.contentWindow;

      const parsedMessage = JSON.parse(message) as IPlayerState;

      console.log("ClientsAllUpdatePlayerState", { parsedMessage });

      switch (parsedMessage.eventType) {
        case "changeVideoUrl":
          setPlayerState({
            originalUrl: parsedMessage.originalUrl,
            embedUrl: parsedMessage.embedUrl,
            eventType: parsedMessage.eventType,
          });
          break;

        case "play":
          player?.postMessage(
            '{"event":"command","func":"playVideo","args":""}',
            "*"
          );
          break;

        case "pause":
          player?.postMessage(
            '{"event":"command","func":"pauseVideo","args":""}',
            "*"
          );
          break;
      }

      setPlayerState(parsedMessage);
    });

    ServerSendRegisterNewUser();
  }, []);

  function ServerUpdatePlayerState(message: IPlayerState) {
    if (connection.state !== signalR.HubConnectionState.Connected) {
      console.log("Connection is not connected");
      return;
    }

    connection
      .invoke("ServerUpdatePlayerState", JSON.stringify(message))
      .catch((err) => console.error(err));
  }

  function ServerSendRegisterNewUser(isAdmin: boolean = false) {
    const message = JSON.stringify(currentUser);

    connection
      .invoke("ServerSendRegisterNewUser", message)
      .catch((err) => console.error(err));
  }

  function onSetOriginalInputUrl(value: string) {
    setErrorMessage("");
    try {
      if (!value) {
        setErrorMessage("Invalid URL");
        return;
      }

      const videoUrl = new URL(value);

      const isYoutube =
        videoUrl.hostname === "youtu.be" ||
        videoUrl.hostname === "www.youtube.com";

      if (!isYoutube) {
        setErrorMessage("Link is not from YouTube");
        return;
      }

      const videoId =
        videoUrl.hostname === "youtu.be"
          ? videoUrl.pathname.slice(1)
          : new URLSearchParams(videoUrl.search).get("v");

      const correctEmbedUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&html5=1`;

      const playerState = {
        originalUrl: value,
        embedUrl: correctEmbedUrl,
        eventType: "changeVideoUrl",
      } as IPlayerState;

      if (correctEmbedUrl) {
        const updatedValues = [...oldValues, videoUrl];

        setOldValues(updatedValues);
        localStorage.setItem("urlHistory", JSON.stringify(updatedValues));
      }

      setPlayerState(playerState);
      ServerUpdatePlayerState(playerState);
    } catch (error) {
      console.error(error);
      setErrorMessage("Invalid URL");
    }
  }

  function onChangeVideoUrl() {
    onSetOriginalInputUrl(inputValue);
  }

  function onControlVideoPlayBack() {
    const player = iframePlayerRef.current?.contentWindow;

    const nextEventType = playerState.eventType === "play" ? "pause" : "play";

    const updatedPlayerState = {
      ...playerState,
      eventType: nextEventType,
    } as IPlayerState;

    if (playerState.eventType === "play") {
      player?.postMessage(
        '{"event":"command","func":"pauseVideo","args":""}',
        "*"
      );
    } else {
      player?.postMessage(
        '{"event":"command","func":"playVideo","args":""}',
        "*"
      );
    }

    setPlayerState(updatedPlayerState);
    ServerUpdatePlayerState(updatedPlayerState);
  }

  function setCurrenUserInformation() {
    setCurrentUser({ ...currentUser, userId: crypto.randomUUID() });
  }

  function setNameToCurrentUser(name: string) {
    setCurrentUser({ ...currentUser, name: name });
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        rowGap: "1rem",
        columnGap: "1rem",
        background: "#0f0f0f",
        color: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "row",
          rowGap: "10px",
          columnGap: "10px",
        }}
      >
        <input
          style={{
            background: "white",
            color: "black",
            padding: "10px",
            borderRadius: "5px",
            width: "600px",
          }}
          placeholder="Introduceti numele"
          type="text"
          onChange={(e) => setNameToCurrentUser(e.target.value)}
        />

        <button
          style={{
            background: "white",
            color: "black",
            padding: "10px",
            borderRadius: "5px",
          }}
          onClick={() => ServerSendRegisterNewUser()}
        >
          Inregistrare
        </button>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "row",
          rowGap: "10px",
          columnGap: "10px",
        }}
      >
        <input
          type="text"
          autoComplete="on"
          placeholder="Enter YouTube URL"
          onChange={(e) => {
            const newValue = e.target.value;
            setInputValue(newValue);
          }}
          style={{
            background: "white",
            color: "black",
            padding: "10px",
            borderRadius: "5px",
            width: "600px",
          }}
          list="previousValues"
        ></input>
        <datalist id="previousValues">
          {oldValues.map((value, index) => (
            <option key={index} value={value} />
          ))}
        </datalist>

        <button
          disabled={!inputValue}
          style={{
            background: "white",
            color: "black",
            padding: "10px",
            borderRadius: "5px",
          }}
          onClick={() => {
            onChangeVideoUrl();
          }}
        >
          Change Video 📽️
        </button>

        <button
          style={{
            background: "white",
            color: "black",
            padding: "10px",
            borderRadius: "5px",
          }}
          disabled={!playerState || !playerState.embedUrl || !inputValue}
          onClick={() => onControlVideoPlayBack()}
        >
          {["changeVideoUrl", "none"].includes(playerState.eventType)
            ? "▶️"
            : "⏹️"}
        </button>
      </div>

      {errorMessage && <div style={{ color: "red" }}>{errorMessage}</div>}

      {!errorMessage && (
        <div>
          <iframe
            ref={iframePlayerRef}
            width="560"
            height="315"
            src={playerState.embedUrl}
            title="YouTube video player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          ></iframe>
        </div>
      )}
    </div>
  );
}

export default App;
