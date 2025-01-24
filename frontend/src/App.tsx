import { useEffect, useRef, useState } from "react";
import * as signalR from "@microsoft/signalr";

import "./App.css";
import { UUID } from "crypto";

import {
  ArrowBigRight,
  ArrowRightCircle,
  BoxSelectIcon,
  CirclePlus,
  CirclePlusIcon,
  CircleX,
  Delete,
  Pause,
  Play,
  Trash2,
} from "lucide-react";

type EventType =
  | "none"
  | "initial"
  | "play"
  | "pause"
  | "stop"
  | "seek"
  | "volume"
  | "mute"
  | "unmute"
  | "addItemToPlaylist"
  | "removeItemFromPlaylist"
  | "changeCurrentPlayingItem";

interface IPlaylistItem {
  url: string;
  embeddedUrl: string;
  title: string;
  thumbnail: string;
  isCurrentlyPlaying: boolean;
}

interface IPlayerState {
  originalUrl?: string;
  embedUrl: string;
  eventType: EventType;
  playlistItems?: IPlaylistItem[];
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

  const [playerState, setPlayerState] = useState<IPlayerState>({
    originalUrl: "",
    embedUrl: "",
    eventType: "none",
    playlistItems: [],
  });

  const [newLink, setNewLink] = useState("");
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
        case "changeCurrentPlayingItem":
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

  function getEmbedUrl(value: string) {
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

      const correctEmbedUrl = `https://www.youtube.com/embed/${videoId}?enablejsapi=1&html5=1&autoplay=1&muted=1&modestbranding=1"`;
      return correctEmbedUrl;
    } catch (error) {
      console.error(error);
      setErrorMessage("Invalid URL");
    }
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

  const updatePlayerState = (updates: Partial<IPlayerState>) => {
    console.log(updates);
    if (playerState.playlistItems) {
    }

    setPlayerState((prev) => ({
      ...prev,
      ...updates,
    }));
  };

  function onAddUrlToPlaylistClicked(url: string) {
    const embedUrl = getEmbedUrl(url);

    if (!embedUrl) {
      return;
    }

    const updates = playerState;

    updates.playlistItems?.push({
      url: url,
      embeddedUrl: embedUrl,
      thumbnail: "",
      title: "",
      isCurrentlyPlaying: false,
    });

    updatePlayerState(updates);

    setNewLink("");
  }

  function getCurrentlyPlaying() {
    const currentlyPlaying = playerState.playlistItems?.filter(
      (x) => x.isCurrentlyPlaying
    )[0]?.embeddedUrl;

    if (!currentlyPlaying) {
      return undefined;
    }

    return currentlyPlaying;
  }

  return (
    <div className="h-screen  w-screen bg-[#141f22] p-8 flex items-center justify-center">
      <div className="bg-[#19262d] rounded-xl p-8 shadow-2xl h-full w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column - Playlist */}
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                value={newLink}
                onChange={(e) => {
                  setNewLink(e.target.value);
                  setErrorMessage("");
                }}
                placeholder="Add new YouTube link to playlist"
                className="bg-[#19262d] border-[#39db7b] text-[#39db7b] placeholder:text-[#39db7b]/50 px-4 py-2 rounded-lg w-full focus:outline-none  border border-[#39db7b]/20"
              />
              <button
                disabled={!newLink}
                className="bg-[#39db7b] hover:bg-[#39db7b]/90 text-[#19262d] font-medium px-6 py-2 rounded-lg cursor-pointer border border-[#39db7b] disabled:opacity-50 hover:shadow-lg  hover:scale-105 transition-transform hover:opacity-90"
                onClick={() => onAddUrlToPlaylistClicked(newLink)}
              >
                Add
              </button>
            </div>

            <div className="flex gap-4">
              {errorMessage && (
                <div className="text-[#39db7b]">{errorMessage}</div>
              )}
            </div>

            <div className="space-y-4 p-5 rounded-lg border border-[#39db7b]/20 w-full h-full ">
              {playerState?.playlistItems?.length == 0 && (
                <p className="p-4 rounded-lg text-[#39db7b] hover:bg-[#39db7b]/10 transition-colors cursor-pointer text-[#39db7b] italic text">
                  Empty playlist...
                </p>
              )}

              {/* playlist items */}
              {playerState.playlistItems?.map((item, index) => (
                <div
                  key={index}
                  className={`flex column justify-between p-4 rounded-lg border border-[#39db7b]/20 text-[#39db7b] hover:bg-[#39db7b]/10 transition-colors cursor-pointer ${
                    item.isCurrentlyPlaying ? `bg-[#39db7b]/10` : ``
                  }`}
                >
                  <div>{item.url}</div>

                  <div
                    id={`playlist-btn--${index}`}
                    className="flex row gap-10"
                  >
                    <button
                      onClick={() => {
                        const updatedPlaylist =
                          playerState.playlistItems?.filter(
                            (_, i) => i !== index
                          );
                        updatePlayerState({ playlistItems: updatedPlaylist });
                      }}
                      className="p-2 bg-[#39db7b] hover:bg-[#39db7b]/90 text-[#19262d] font-medium rounded-lg cursor-pointer border border-[#39db7b] disabled:opacity-50 hover:shadow-lg hover:scale-105 transition-transform hover:opacity-90"
                    >
                      <CircleX />
                    </button>

                    <button
                      onClick={() => {
                        const updatedPlaylistItems = playerState.playlistItems;

                        for (const element of updatedPlaylistItems) {
                          if (element.url == item.url) {
                            element.isCurrentlyPlaying = true;
                          } else {
                            element.isCurrentlyPlaying = false;
                          }
                        }
                        updatePlayerState({
                          eventType: "addItemToPlaylist",
                          playlistItems: updatedPlaylistItems,
                        });
                      }}
                      className="p-2 bg-[#39db7b] hover:bg-[#39db7b]/90 text-[#19262d] font-medium rounded-lg cursor-pointer border border-[#39db7b] disabled:opacity-50 hover:shadow-lg hover:scale-105 transition-transform hover:opacity-90"
                    >
                      <ArrowRightCircle />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - Video Player */}
          <div className="">
            <div className="flex flex-col min-h-[600px] min-w-[1000px] justify-start items-center">
              {!errorMessage && (
                <div className="rounded-lg border border-[#39db7b]/20">
                  {/* // TODO: use */}
                  {/* https://developers.google.com/youtube/iframe_api_reference */}
                  <iframe
                    id="yt-player"
                    ref={iframePlayerRef}
                    className="rounded-lg"
                    src={getCurrentlyPlaying()}
                    title="YouTube video player"
                    width="1000"
                    height="562.5"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  ></iframe>
                </div>
              )}
            </div>

            <div className="flex justify-center p-10">
              <button
                disabled={!playerState}
                onClick={() => onControlVideoPlayBack()}
                className="w-40 h-20 bg-[#39db7b] hover:bg-[#39db7b]/90 text-[#19262d] font-medium px-6 py-2 rounded-lg cursor-pointer border border-[#39db7b] disabled:opacity-50 hover:shadow-lg  hover:scale-105 transition-transform hover:opacity-90"
              >
                <div className="text-[#19262d] flex items-center justify-center ">
                  {playerState.eventType === "play" ? (
                    <Pause size={64} />
                  ) : (
                    <Play size={64} />
                  )}
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
