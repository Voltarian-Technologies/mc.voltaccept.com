# server.py – Simplified: Removed emotes, focus on AI chat
import asyncio
import json
import websockets
import uuid
import traceback
import os
import time
import re
import random
from ai_player import AIPlayer

# Note: This server runs locally on port 8765
# Cloudflared tunnel forwards wss://ws.voltaccept.com to ws://localhost:8765
HOST = "localhost"
PORT = 8765

# Maximum display name length (matches client)
MAX_NAME_LENGTH = 12  # 12 characters

connected_players = {}
persistent_players = {}
ai_players = {}
ai_tasks = {}  # Store AI update tasks
PLAYERS_FILE = "data/players_data.json"

# AI Player configurations - Updated with GEMIN-EYE
AI_PLAYERS = [
    {"display_name": "Grokzilla", "personality": "explorer"},
    {"display_name": "QuantumGPT", "personality": "friendly"},
    {"display_name": "ClippyReborn", "personality": "friendly"},
    {"display_name": "GEMIN-EYE", "personality": "explorer"},  # New AI from Google's Gemini
]

# Profanity filter patterns
PROFANITY_PATTERNS = [
    r'\bass\b', r'\bdamn\b', r'\bhell\b', r'\bfuck\b', r'\bshit\b',
    r'\bbitch\b', r'\bcunt\b', r'\bdick\b', r'\bpussy\b', r'\btwat\b',
    r'\bwhore\b', r'\bslut\b', r'\bnigger\b', r'\bspic\b', r'\bchink\b',
    r'\bkike\b', r'\bfag\b', r'\bretard\b', r'\bidiot\b', r'\bmoron\b'
]

# Common offensive words to filter
PROFANITY_WORDS = {
    'ass', 'asshole', 'bastard', 'bitch', 'cock', 'cunt', 'damn', 'dick',
    'fag', 'faggot', 'fuck', 'jerk', 'nigger', 'piss', 'pussy',
    'shit', 'slut', 'twat', 'whore'
}


def filter_profanity(text: str) -> str:
    """Filter profanity from text"""
    if not text:
        return text
    
    text_lower = text.lower()
    
    for word in PROFANITY_WORDS:
        pattern = r'\b' + re.escape(word) + r'\b'
        if re.search(pattern, text_lower):
            text = re.sub(pattern, '*' * len(word), text, flags=re.IGNORECASE)
    
    for pattern in PROFANITY_PATTERNS:
        text = re.sub(pattern, '****', text, flags=re.IGNORECASE)
    
    return text


def is_profane(text: str) -> bool:
    """Check if text contains profanity"""
    if not text:
        return False
    
    text_lower = text.lower()
    
    for word in PROFANITY_WORDS:
        pattern = r'\b' + re.escape(word) + r'\b'
        if re.search(pattern, text_lower):
            return True
    
    for pattern in PROFANITY_PATTERNS:
        if re.search(pattern, text_lower):
            return True
    
    return False


def load_persistent_data():
    global persistent_players
    if os.path.exists(PLAYERS_FILE):
        try:
            with open(PLAYERS_FILE, "r") as f:
                persistent_players = json.load(f)
            print(f"[LOAD] Loaded {len(persistent_players)} saved players")
        except Exception as e:
            print(f"[ERROR] Load failed: {e}")


def save_persistent_data():
    try:
        with open(PLAYERS_FILE, "w") as f:
            json.dump(persistent_players, f, indent=2)
    except Exception as e:
        print(f"[ERROR] Save failed: {e}")


def get_or_create_player(os_username: str, display_name: str = None) -> dict:
    """Get existing player or create new."""
    if display_name:
        # Truncate display name if it exceeds max length
        if len(display_name) > MAX_NAME_LENGTH:
            print(f"[INFO] Truncating display name '{display_name}' from {len(display_name)} to {MAX_NAME_LENGTH} characters")
            display_name = display_name[:MAX_NAME_LENGTH]
        
        if is_profane(display_name):
            filtered_name = filter_profanity(display_name)
            if filtered_name == display_name:
                filtered_name = f"Player_{os_username[:8]}"
                # Truncate again if needed
                if len(filtered_name) > MAX_NAME_LENGTH:
                    filtered_name = filtered_name[:MAX_NAME_LENGTH]
            display_name = filtered_name
    
    if os_username not in persistent_players:
        namespace = uuid.UUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')
        player_uuid = str(uuid.uuid5(namespace, os_username))
        persistent_players[os_username] = {
            "uuid": player_uuid,
            "display_name": display_name or os_username[:MAX_NAME_LENGTH],  # Ensure it doesn't exceed max length
            "os_username": os_username,
            "position": {"x": 400.0, "y": 300.0},
            "ground_y": 300.0,
            "map_width": 800.0
        }
        save_persistent_data()
    else:
        if not os_username.startswith("AI_") and persistent_players[os_username]["display_name"] != display_name:
            # Truncate new display name if needed
            if display_name and len(display_name) > MAX_NAME_LENGTH:
                display_name = display_name[:MAX_NAME_LENGTH]
            persistent_players[os_username]["display_name"] = display_name or os_username[:MAX_NAME_LENGTH]
            save_persistent_data()
            print(f"[INFO] Updated display_name for {os_username}: {persistent_players[os_username]['display_name']}")
    
    return persistent_players[os_username]


def make_player_info(player_data: dict, is_ai: bool = False) -> dict:
    info = {
        "id": player_data["uuid"],
        "name": player_data["display_name"],
        "os_username": player_data["os_username"],
        "position": player_data["position"]
    }
    if is_ai:
        info["is_ai"] = True
    return info


async def broadcast(packet, except_ws=None):
    if not connected_players:
        return
    message = json.dumps(packet)
    tasks = []
    for ws in connected_players:
        if ws == except_ws:
            continue
        tasks.append(ws.send(message))
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def spawn_ai_player(ground_y: float, map_width: float):
    """Spawn an AI player"""
    if len(ai_players) >= len(AI_PLAYERS):
        return None
    
    ai_config = AI_PLAYERS[len(ai_players)]
    
    ai_player = AIPlayer(
        display_name=ai_config["display_name"],
        personality=ai_config["personality"],
        x=random.uniform(100, map_width - 100),
        y=ground_y,
        ground_y=ground_y,
        map_width=map_width
    )
    
    ai_username = f"AI_{ai_player.display_name}"
    persistent_players[ai_username] = {
        "uuid": ai_player.id,
        "display_name": ai_player.display_name,
        "os_username": ai_username,
        "position": ai_player.position,
        "ground_y": ground_y,
        "map_width": map_width,
        "is_ai": True
    }
    
    ai_players[ai_player.id] = ai_player
    
    print(f"[AI] Spawned {ai_player.display_name} ({ai_player.personality} personality)")
    return ai_player


async def despawn_all_ai():
    """Despawn all AI players when no human players are online"""
    if not ai_players:
        return
    
    print(f"[AI] Despawning all {len(ai_players)} AI players")
    
    # Cancel all AI tasks
    for ai_id in list(ai_players.keys()):
        ai = ai_players[ai_id]
        if hasattr(ai, 'task') and ai.task:
            ai.task.cancel()
            try:
                await ai.task
            except asyncio.CancelledError:
                pass
    
    # Broadcast player_left for each AI
    for ai_id, ai_player in list(ai_players.items()):
        ai_username = f"AI_{ai_player.display_name}"
        if ai_username in persistent_players:
            del persistent_players[ai_username]
        
        await broadcast({
            "type": "player_left",
            "player_id": ai_id
        })
    
    # Clear AI players dictionary
    ai_players.clear()
    ai_tasks.clear()
    
    print("[AI] All AI players despawned")


async def broadcast_chat(sender_name: str, message: str):
    """Broadcast chat message to all players and notify AI players"""
    filtered_message = filter_profanity(message)
    
    # Send to AI players for mention detection
    for ai_id, ai_player in ai_players.items():
        ai_player.add_chat_message(sender_name, filtered_message)
    
    # Broadcast to all players
    await broadcast({
        "type": "chat_message",
        "sender": sender_name,
        "message": filtered_message,
        "timestamp": time.time()
    })


async def main():
    load_persistent_data()

    print(f"Server starting on ws://{HOST}:{PORT}")
    print(f"Cloudflared tunnel: wss://ws.voltaccept.com → ws://{HOST}:{PORT}")
    print(f"AI Players available: {len(AI_PLAYERS)}")
    print(f"Maximum display name length: {MAX_NAME_LENGTH} characters")
    print("AI will respond to mentions in chat!")
    print("AI Types: Grokzilla (Grok/X.AI), QuantumGPT (ChatGPT/OpenAI), ClippyReborn (Copilot/Microsoft), GEMIN-EYE (Google Gemini)")
    print("Using model: llama-3.1-8b-instant for all AI players")

    async def handle_client(ws):
        player_data = None
        player_uuid = None

        print("[CONNECT] New client")

        try:
            async for raw in ws:
                try:
                    data = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                typ = data.get("type")

                if typ == "join":
                    os_username = data.get("os_username", "")
                    display_name = data.get("display_name", os_username)
                    ground_y = float(data.get("ground_y", 300.0))
                    map_width = float(data.get("map_width", 800.0))

                    if not os_username:
                        await ws.send(json.dumps({"type": "error", "message": "os_username required"}))
                        continue
                    
                    # Check display name length
                    if len(display_name) > MAX_NAME_LENGTH:
                        await ws.send(json.dumps({
                            "type": "error", 
                            "message": f"Display name cannot exceed {MAX_NAME_LENGTH} characters. Your name was {len(display_name)} characters."
                        }))
                        continue
                    
                    if is_profane(display_name):
                        filtered_name = filter_profanity(display_name)
                        if filtered_name == display_name:
                            await ws.send(json.dumps({
                                "type": "error", 
                                "message": "Display name contains inappropriate language. Please choose another name."
                            }))
                            continue
                        else:
                            display_name = filtered_name

                    player = get_or_create_player(os_username, display_name)
                    player["ground_y"] = ground_y
                    player["map_width"] = map_width
                    player["position"]["y"] = ground_y
                    player_uuid = player["uuid"]
                    connected_players[ws] = player

                    await ws.send(json.dumps({
                        "type": "init",
                        "id": player_uuid,
                        "display_name": player["display_name"],
                        "position": player["position"],
                        "is_ai": False
                    }))

                    all_players = [make_player_info(p) for p in connected_players.values()]
                    for ai_id, ai_player in ai_players.items():
                        all_players.append({
                            "id": ai_player.id,
                            "name": ai_player.display_name,
                            "os_username": ai_player.os_username,
                            "position": ai_player.position,
                            "is_ai": True
                        })

                    await ws.send(json.dumps({
                        "type": "player_list", 
                        "players": all_players
                    }))

                    human_count = len([p for p in connected_players.values() if not p.get("is_ai", False)])
                    
                    # Spawn AI players only when first human joins
                    if human_count == 1 and not ai_players:
                        print("First human player joined! Spawning AI players...")
                        for _ in range(len(AI_PLAYERS)):
                            ai_player = await spawn_ai_player(ground_y, map_width)
                            if ai_player:
                                def get_players_func():
                                    all_players_list = []
                                    for p in connected_players.values():
                                        all_players_list.append({
                                            "id": p["uuid"],
                                            "position": p["position"],
                                            "name": p["display_name"]
                                        })
                                    for ai_id, ai in ai_players.items():
                                        if ai.id != ai_player.id:
                                            all_players_list.append({
                                                "id": ai.id,
                                                "position": ai.position,
                                                "name": ai.display_name
                                            })
                                    return all_players_list

                                async def broadcast_update_func(packet):
                                    await broadcast(packet)

                                # Create and store the AI task
                                ai_task = asyncio.create_task(ai_player.update_loop(
                                    get_players_func,
                                    broadcast_update_func,
                                    broadcast_chat
                                ))
                                ai_player.task = ai_task  # Store task reference
                                ai_tasks[ai_player.id] = ai_task

                                await broadcast({
                                    "type": "player_joined",
                                    "player": {
                                        "id": ai_player.id,
                                        "name": ai_player.display_name,
                                        "os_username": ai_player.os_username,
                                        "position": ai_player.position,
                                        "is_ai": True
                                    }
                                })

                elif typ == "position_update" and player_uuid:
                    player = connected_players[ws]
                    player["position"]["x"] = float(data.get("x", player["position"]["x"]))
                    player["position"]["y"] = float(data.get("y", player["position"]["y"]))

                    await broadcast({
                        "type": "position_update",
                        "player_id": player_uuid,
                        "position": player["position"],
                        "animation_id": data.get("animation_id", "idle"),
                        "facing_left": data.get("facing_left", False)
                    }, except_ws=ws)

                elif typ == "chat_message":
                    player = connected_players.get(ws)
                    if player:
                        message = data.get("message", "")
                        if is_profane(message):
                            filtered_message = filter_profanity(message)
                            if filtered_message == message:
                                await ws.send(json.dumps({
                                    "type": "error",
                                    "message": "Message contains inappropriate language and cannot be sent."
                                }))
                                continue
                            else:
                                message = filtered_message
                        await broadcast_chat(player["display_name"], message)

        except websockets.ConnectionClosed:
            pass
        except Exception as e:
            print(f"[ERROR] {traceback.format_exc()}")
        finally:
            if ws in connected_players:
                player = connected_players.pop(ws)
                print(f"[DISCONNECT] {player['display_name']} left")
                
                # Check if any human players remain
                human_count = len([p for p in connected_players.values() if not p.get("is_ai", False)])
                
                # Despawn all AI if no human players remain
                if human_count == 0 and ai_players:
                    await despawn_all_ai()
                
                # Update player list
                all_players = [make_player_info(p) for p in connected_players.values()]
                for ai_id, ai_player in ai_players.items():
                    all_players.append({
                        "id": ai_player.id,
                        "name": ai_player.display_name,
                        "os_username": ai_player.os_username,
                        "position": ai_player.position,
                        "is_ai": True
                    })
                
                await broadcast({
                    "type": "player_list", 
                    "players": all_players
                })

    async with websockets.serve(handle_client, HOST, PORT):
        print("WebSocket server is RUNNING with Responsive AI Players!")
        print("AI will respond when mentioned: 'Hello Clippy', 'Hey Grokzilla', etc.")
        print("Access via Cloudflared tunnel: wss://ws.voltaccept.com")
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())