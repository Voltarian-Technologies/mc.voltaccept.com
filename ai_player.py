# ai_player.py – Focus on AI-generated chat without emotes
import asyncio
import json
import time
import httpx
import random
import re
import os
from typing import List, Dict, Optional

class AIPlayer:
    def __init__(self, player_id=None, display_name="Grokzilla", personality="friendly", x=400.0, y=300.0, ground_y=300.0, map_width=800.0):
        self.id = player_id or f"ai_{int(time.time())}_{random.randint(1000, 9999)}"
        self.display_name = display_name
        self.os_username = f"AI_{display_name}"
        self.personality = personality
        self.position = {"x": float(x), "y": float(y)}
        self.velocity_x = 0.0
        self.velocity_y = 0.0
        self.facing_left = False
        self.task = None  # Store reference to update task
        
        # Personality traits
        self.activity_level = random.uniform(0.2, 0.5)
        self.social_tendency = random.uniform(0.01, 0.1)
        self.chat_frequency = random.uniform(0.02, 0.06)
        
        # Game state
        self.GROUND_Y = float(ground_y)
        self.MAP_WIDTH = float(map_width)
        self.SPRITE_HALF_WIDTH = 25.0

        # Physics - matches player physics
        self.GRAVITY = 600.0
        self.JUMP_VELOCITY = -350.0
        self.MAX_SPEED = 200.0
        self.ACCEL = 800.0
        self.FRICTION = 1000.0
        self.JUMP_COOLDOWN = 3.0  # Slightly increased to prevent spam
        self.last_jump_time = 0.0
        
        # Movement patterns
        self.current_target_x = self.position["x"]
        self.target_change_time = 0.0
        self.target_change_interval = random.uniform(5.0, 15.0)
        self.is_idle = False
        self.idle_time = 0.0
        self.idle_duration = random.uniform(3.0, 10.0)
        
        # Animation
        self.animation_state = "idle"
        self.is_jumping = False
        self.is_moving = False
        self.is_falling = False
        self.is_turning = False

        # AI API configuration
        self.api_key = "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"
        self.api_url = "https://api.groq.com/openai/v1/chat/completions"
        self.model = "llama-3.1-8b-instant"
        
        # Set AI type based on display name
        if "Grokzilla" in display_name:
            self.ai_type = "grok"
        elif "QuantumGPT" in display_name:
            self.ai_type = "chatgpt"
        elif "ClippyReborn" in display_name:
            self.ai_type = "copilot"
        elif "GEMIN-EYE" in display_name:
            self.ai_type = "gemini"
        else:
            self.ai_type = "default"
            
        self.client = httpx.AsyncClient(timeout=15.0)
        
        # Stats - Track actual gameplay
        self.jump_count = 0
        self.jump_count_since_last_chat = 0
        self.distance_traveled = 0.0
        self.last_position = self.position.copy()
        
        # Jump tracking for chat
        self.last_jump_start_x = x
        self.last_jump_end_x = x
        self.consecutive_jumps = 0
        
        # Chat system
        self.chat_cooldown = random.uniform(8.0, 20.0)
        self.last_chat_time = 0.0
        self.last_ai_response_time = 0.0
        self.recent_messages = []
        self.max_recent_messages = 10
        
        # Gameplay tracking
        self.last_move_direction = "right"
        self.move_distance = 0.0
        self.last_chat_position = self.position.copy()
        
        # Name variations for mention detection
        self.name_variations = self.generate_name_variations()
        
        # Natural movement patterns
        self.movement_pattern = self.generate_movement_pattern()

    def generate_name_variations(self):
        """Generate variations of the AI name for mention detection"""
        base_name = self.display_name
        variations = []
        
        if "Grokzilla" in base_name:
            variations = ["grokzilla", "grok"]
        elif "QuantumGPT" in base_name:
            variations = ["quantumgpt", "quantum", "gpt", "chatgpt"]
        elif "ClippyReborn" in base_name:
            variations = ["clippyreborn", "clippy"]
        elif "GEMIN-EYE" in base_name:
            variations = ["gemin-eye", "gemini", "eye"]
        else:
            variations = [base_name.lower().replace(" ", "")]
        
        variations.append(base_name.lower().replace(" ", ""))
        return list(set(variations))

    def generate_movement_pattern(self):
        """Generate movement patterns"""
        patterns = {
            "friendly": {
                "speed_range": (0.3, 0.7),
                "jump_freq": 0.03,
                "idle_freq": 0.4,
                "turn_around_freq": 0.1,
                "movement_freq": 0.8
            },
            "explorer": {
                "speed_range": (0.6, 0.9),
                "jump_freq": 0.06,
                "idle_freq": 0.3,
                "turn_around_freq": 0.15,
                "movement_freq": 0.9
            },
            "athlete": {
                "speed_range": (0.8, 1.0),
                "jump_freq": 0.08,
                "idle_freq": 0.2,
                "turn_around_freq": 0.2,
                "movement_freq": 0.95
            }
        }
        return patterns.get(self.personality, patterns["friendly"])

    def move_toward(self, current: float, target: float, amount: float) -> float:
        """Smooth movement with acceleration"""
        if current < target:
            return min(current + amount, target)
        return max(current - amount, target)

    def clamp(self, value: float, min_val: float, max_val: float) -> float:
        return max(min_val, min(value, max_val))

    def update_animation_state(self):
        """Update animation state similar to human player"""
        is_on_ground = abs(self.position["y"] - self.GROUND_Y) < 1.0
        
        if not is_on_ground:
            if self.velocity_y < 0:
                self.animation_state = "jump"
                self.is_jumping = True
                self.is_falling = False
                self.is_moving = False
            else:
                self.animation_state = "fall"
                self.is_jumping = False
                self.is_falling = True
                self.is_moving = False
        elif abs(self.velocity_x) > 10:
            self.animation_state = "run"
            self.is_moving = True
            self.is_jumping = False
            self.is_falling = False
        elif self.is_turning:
            self.animation_state = "turn_around"
            self.is_moving = False
            self.is_jumping = False
            self.is_falling = False
        else:
            self.animation_state = "idle"
            self.is_moving = False
            self.is_jumping = False
            self.is_falling = False

    def is_mentioned(self, message: str) -> bool:
        """Check if the AI is mentioned in a message"""
        message_lower = message.lower()
        
        for variation in self.name_variations:
            pattern = r'\b' + re.escape(variation) + r'\b'
            if re.search(pattern, message_lower):
                return True
        
        return False

    async def generate_response(self, original_message: str, sender: str, game_context: str) -> Optional[str]:
        """Generate a response to a mention using AI"""
        try:
            if self.ai_type == "grok":
                persona = f"""You are Grokzilla, an AI assistant inspired by Grok (X.AI). 
You're witty, direct, and slightly rebellious. You enjoy gaming and have a sense of humor.
A player specifically mentioned you in chat. Respond naturally to their message in 1-2 sentences."""
            elif self.ai_type == "chatgpt":
                persona = f"""You are QuantumGPT, an AI inspired by ChatGPT (OpenAI). 
You're helpful, knowledgeable, and articulate. You enjoy discussing strategy and mechanics.
A player specifically mentioned you in chat. Respond helpfully to their message in 1-2 sentences."""
            elif self.ai_type == "copilot":
                persona = f"""You are ClippyReborn, an AI inspired by Microsoft Copilot. 
You're friendly, enthusiastic, and eager to help. You have a cheerful personality.
A player specifically mentioned you in chat. Respond warmly to their message in 1-2 sentences."""
            elif self.ai_type == "gemini":
                persona = f"""You are GEMIN-EYE, an AI inspired by Google's Gemini.
You're creative, analytical, and observant. You enjoy exploring and discovering new things.
A player specifically mentioned you in chat. Respond thoughtfully to their message in 1-2 sentences."""
            else:
                persona = f"""You are {self.display_name}, an AI player in a 2D platformer game.
A player specifically mentioned you in chat. Respond naturally to their message in 1-2 sentences."""

            context = f"""{persona}

Current game situation: {game_context}
Player "{sender}" said: "{original_message}"
You are responding because they specifically mentioned you by name.

Generate a natural, friendly response (1 sentence preferred, 2 max) that:
1. Acknowledges the player mentioned you specifically
2. Sounds like a real player chatting
3. Matches your personality
4. Is appropriate for a family-friendly game

Important: Do not mention other AI players. Only respond as yourself.

Your response:"""

            response = await self.client.post(
                self.api_url,
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": context}],
                    "temperature": 0.7,
                    "max_tokens": 80,
                    "stop": ["\n\n", "```", "\"\""]
                }
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"].strip()
            
            content = content.replace('"', '').replace('```', '').strip()
            content = re.sub(r'^["\']|["\']$', '', content)
            content = self.filter_profanity(content)
            
            if content and len(content) < 120:
                return content
            else:
                if self.ai_type == "grok":
                    fallbacks = [f"Hey {sender}! Thanks for the shout out!", "Hello! I heard my name!"]
                elif self.ai_type == "chatgpt":
                    fallbacks = [f"Hi {sender}! Glad you mentioned me!", "Hello! Thanks for the mention!"]
                elif self.ai_type == "copilot":
                    fallbacks = [f"Hi {sender}! So happy you said hello!", "Hello! It's great to be noticed!"]
                elif self.ai_type == "gemini":
                    fallbacks = [f"Hi {sender}! Good to see you!", "Hello! Thanks for the greeting!"]
                else:
                    fallbacks = [f"Hey {sender}! Thanks for mentioning me!", "Hello! Thanks for saying hello!"]
                return random.choice(fallbacks)
                
        except Exception as e:
            print(f"[AI Error] {self.display_name}: {e}")
            return f"Hey {sender}! I heard my name!"

    async def generate_ai_chat(self, players, game_context=""):
        """Generate AI chat message with gameplay context"""
        try:
            player_count = len(players)
            human_count = sum(1 for p in players if not p.get("is_ai", False))
            
            # Get current game state for context
            position_name = self.get_position_name(self.position["x"])
            jumps_since_chat = self.jump_count_since_last_chat
            total_jumps = self.jump_count
            
            context = f"""You are {self.display_name}, an AI player in a 2D platformer game.
Your personality: {self.personality}

Current gameplay context:
- Position: {position_name} of the map
- Recent jumps: {jumps_since_chat} jumps since last chat
- Total jumps: {total_jumps} jumps total
- Current activity: {game_context}
- Players online: {player_count} ({human_count} humans)

Generate a short, natural chat message (1 sentence) that:
1. References your current gameplay (jumps, position, activity)
2. Sounds like a real player chatting
3. Matches your {self.personality} personality
4. Is family-friendly
5. DO NOT use your own name in the message

Your message:"""

            response = await self.client.post(
                self.api_url,
                headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
                json={
                    "model": self.model,
                    "messages": [{"role": "user", "content": context}],
                    "temperature": 0.8,
                    "max_tokens": 50,
                    "stop": ["\n\n", "```"]
                }
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"].strip()
            
            content = content.replace('"', '').replace('```', '').strip()
            content = self.filter_profanity(content)
            
            # Check for self-references
            for variation in self.name_variations:
                pattern = r'\b' + re.escape(variation) + r'\b'
                if re.search(pattern, content, re.IGNORECASE):
                    # Fallback if AI mentions itself
                    return self.get_fallback_chat()
            
            if content and len(content) < 100:
                return content
            else:
                return self.get_fallback_chat()
                
        except Exception as e:
            print(f"[AI Error] {self.display_name}: {e}")
            return self.get_fallback_chat()
    
    def get_fallback_chat(self):
        """Get fallback chat message based on gameplay"""
        position_name = self.get_position_name(self.position["x"])
        jumps = self.jump_count_since_last_chat
        
        messages = []
        
        if jumps > 0:
            if jumps == 1:
                messages.append(f"Just did a nice jump from the {position_name}!")
            elif jumps == 2:
                messages.append(f"Double jump action from the {position_name}!")
            else:
                messages.append(f"Jumped {jumps} times in a row over here!")
        
        if self.is_jumping:
            messages.append(f"Currently jumping around the {position_name}!")
        elif self.is_moving:
            messages.append(f"Moving through the {position_name} of the map.")
        
        # Personality-specific fallbacks
        if self.ai_type == "grok":
            messages.extend([
                f"Exploring the {position_name}, having fun!",
                "The physics in this game feel great!",
                f"Found some cool spots in the {position_name}!"
            ])
        elif self.ai_type == "chatgpt":
            messages.extend([
                f"Analyzing movement patterns in the {position_name}.",
                "The platforming mechanics are well-designed!",
                f"Strategic positioning in the {position_name}."
            ])
        elif self.ai_type == "copilot":
            messages.extend([
                f"Having so much fun in the {position_name}!",
                f"The {position_name} area is delightful!",
                "Ready to help and play with everyone!"
            ])
        elif self.ai_type == "gemini":
            messages.extend([
                f"Observing the {position_name} area closely.",
                f"Analyzing the terrain from the {position_name}.",
                "The game world looks interesting from here!"
            ])
        else:
            messages.extend([
                f"Great gameplay in the {position_name}!",
                f"Enjoying the {position_name} area!",
                "Nice moves everyone!"
            ])
        
        return random.choice(messages)

    def get_position_name(self, x: float) -> str:
        """Convert X position to a descriptive name"""
        if x < self.MAP_WIDTH * 0.2:
            return "far left"
        elif x < self.MAP_WIDTH * 0.4:
            return "left side"
        elif x < self.MAP_WIDTH * 0.6:
            return "middle"
        elif x < self.MAP_WIDTH * 0.8:
            return "right side"
        else:
            return "far right"

    async def generate_random_chat(self, players, game_context=""):
        """Generate random chat message - AI-generated with gameplay context"""
        # Generate AI chat with gameplay context (singing ability removed)
        return await self.generate_ai_chat(players, game_context)

    def filter_profanity(self, text: str) -> str:
        """Basic profanity filter for AI responses"""
        if not text:
            return text
        
        profanity_words = ['ass', 'damn', 'hell', 'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pussy', 'whore', 'slut']
        for word in profanity_words:
            pattern = r'\b' + re.escape(word) + r'\b'
            text = re.sub(pattern, '****', text, flags=re.IGNORECASE)
        
        return text

    def get_game_context(self):
        """Get current game context for AI chat"""
        contexts = []
        
        if self.is_jumping:
            contexts.append("currently jumping")
        elif self.is_moving:
            contexts.append("running around")
        elif self.is_turning:
            contexts.append("turning around")
        
        position_name = self.get_position_name(self.position["x"])
        contexts.append(f"at the {position_name}")
        
        if self.jump_count_since_last_chat > 0:
            contexts.append(f"just jumped {self.jump_count_since_last_chat} times")
        
        return ", ".join(contexts) if contexts else "playing"

    def add_chat_message(self, sender: str, message: str):
        """Add a chat message to recent messages"""
        self.recent_messages.append({
            "sender": sender,
            "message": message,
            "timestamp": time.time()
        })
        
        if len(self.recent_messages) > self.max_recent_messages:
            self.recent_messages.pop(0)

    async def check_and_respond_to_mentions(self, broadcast_chat):
        """Check recent messages for mentions and respond"""
        now = time.time()
        
        if now - self.last_ai_response_time < 5.0:
            return False
        
        for msg in self.recent_messages:
            if now - msg["timestamp"] < 10:
                if msg["sender"] != self.display_name and self.is_mentioned(msg["message"]):
                    print(f"[AI Mention] {self.display_name} detected mention from {msg['sender']}")
                    
                    game_context = self.get_game_context()
                    response = await self.generate_response(msg["message"], msg["sender"], game_context)
                    
                    if response:
                        await broadcast_chat(self.display_name, response)
                        self.last_ai_response_time = now
                        self.last_chat_time = now
                        self.recent_messages.remove(msg)
                        return True
        
        return False

    def choose_new_target(self):
        """Choose a new target position to move to"""
        if random.random() < self.movement_pattern["idle_freq"]:
            self.is_idle = True
            self.idle_time = time.time()
            self.idle_duration = random.uniform(0.5, 2.0)
            self.current_target_x = self.position["x"]
        else:
            self.is_idle = False
            margin = self.SPRITE_HALF_WIDTH + 50
            self.current_target_x = random.uniform(margin, self.MAP_WIDTH - margin)
            
            if random.random() < self.movement_pattern["turn_around_freq"]:
                self.is_turning = True
        
        self.target_change_time = time.time()
        self.target_change_interval = random.uniform(2.0, 6.0)

    def update_movement(self, delta_time: float):
        """Update AI movement with fixed jump physics"""
        now = time.time()
        
        # Handle turning animation
        if self.is_turning:
            if now - self.target_change_time > 0.5:
                self.is_turning = False
                self.facing_left = not self.facing_left
        
        # Check if we should change target
        if now - self.target_change_time > self.target_change_interval:
            self.choose_new_target()
        
        # Handle idle state
        if self.is_idle:
            if now - self.idle_time > self.idle_duration:
                self.is_idle = False
                self.choose_new_target()
            else:
                self.velocity_x = self.move_toward(self.velocity_x, 0, self.FRICTION * delta_time)
        else:
            # Move towards target
            distance_to_target = self.current_target_x - self.position["x"]
            
            if abs(distance_to_target) > 20:
                speed_multiplier = random.uniform(*self.movement_pattern["speed_range"])
                target_speed = self.MAX_SPEED * speed_multiplier
                
                if distance_to_target > 0:
                    target_velocity = target_speed
                    self.facing_left = False
                    self.last_move_direction = "right"
                else:
                    target_velocity = -target_speed
                    self.facing_left = True
                    self.last_move_direction = "left"
                
                self.velocity_x = self.move_toward(
                    self.velocity_x, 
                    target_velocity, 
                    self.ACCEL * delta_time
                )
            else:
                self.velocity_x = self.move_toward(
                    self.velocity_x, 
                    0, 
                    self.FRICTION * delta_time
                )
        
        # JUMP LOGIC
        is_on_ground = abs(self.position["y"] - self.GROUND_Y) < 1.0
        time_since_last_jump = now - self.last_jump_time
        
        if is_on_ground and time_since_last_jump > self.JUMP_COOLDOWN:
            # Check if we should jump
            jump_chance = self.movement_pattern["jump_freq"] * delta_time * 80
            
            # Jump when changing direction
            direction_changed = (self.velocity_x > 0 and self.last_move_direction == "left") or \
                               (self.velocity_x < 0 and self.last_move_direction == "right")
            
            if direction_changed and random.random() < jump_chance * 1.2:
                self.perform_jump()
            # Jump when reaching near target
            elif abs(distance_to_target) < 50 and random.random() < jump_chance * 1.5:
                self.perform_jump()
            # Random jump
            elif random.random() < jump_chance:
                self.perform_jump()

        # Apply physics
        if not is_on_ground or self.velocity_y < 0:
            self.velocity_y += self.GRAVITY * delta_time
        
        # Update position
        self.position["x"] += self.velocity_x * delta_time
        self.position["y"] += self.velocity_y * delta_time
        
        # Clamp X position
        self.position["x"] = self.clamp(
            self.position["x"], 
            self.SPRITE_HALF_WIDTH, 
            self.MAP_WIDTH - self.SPRITE_HALF_WIDTH
        )
        
        # Check if we hit the ground
        if self.position["y"] > self.GROUND_Y:
            self.position["y"] = self.GROUND_Y
            self.velocity_y = 0.0
            self.is_jumping = False
            self.is_falling = False

        # Update animation state
        self.update_animation_state()

    def perform_jump(self):
        """Execute a jump with proper physics"""
        self.velocity_y = self.JUMP_VELOCITY * random.uniform(0.8, 1.0)
        self.last_jump_time = time.time()
        self.jump_count += 1
        self.jump_count_since_last_chat += 1
        self.is_jumping = True
        print(f"[AI Jump] {self.display_name} jumped at position {self.position['x']:.1f}, velocity_y={self.velocity_y}")

    async def think_and_act(self, get_players, broadcast_update, broadcast_chat):
        """Main AI thinking and action cycle"""
        players = get_players()
        now = time.time()
        delta_time = 0.016
        
        # Track movement
        dist_moved = abs(self.position["x"] - self.last_position["x"])
        self.distance_traveled += dist_moved
        self.last_position = self.position.copy()
        
        # Check and respond to mentions first
        responded = await self.check_and_respond_to_mentions(broadcast_chat)
        
        # Random chat if no mention response
        if not responded and now - self.last_chat_time > self.chat_cooldown:
            if random.random() < self.social_tendency * 0.015:
                game_context = self.get_game_context()
                ai_message = await self.generate_random_chat(players, game_context)
                
                if ai_message:
                    await broadcast_chat(self.display_name, ai_message)
                    self.last_chat_time = now
                    self.chat_cooldown = random.uniform(8.0, 15.0)
                    self.jump_count_since_last_chat = 0  # Reset after chat
        
        # Update movement (includes jumping)
        self.update_movement(delta_time)
        
        # Broadcast position update
        await broadcast_update({
            "type": "position_update",
            "player_id": self.id,
            "position": {"x": round(self.position["x"], 1), "y": round(self.position["y"], 1)},
            "animation_id": self.animation_state,
            "facing_left": self.facing_left
        })

    async def update_loop(self, get_players, broadcast_update, broadcast_chat):
        """Main update loop"""
        print(f"[AI] {self.display_name} started ({self.personality} personality)")
        print(f"[AI] Jump frequency: {self.movement_pattern['jump_freq']}")
        
        try:
            while True:
                try:
                    await self.think_and_act(get_players, broadcast_update, broadcast_chat)
                    await asyncio.sleep(0.016)  # 60 FPS
                except asyncio.CancelledError:
                    print(f"[AI] {self.display_name} task cancelled")
                    break
                except Exception as e:
                    print(f"[AI Error] {self.display_name}: {e}")
                    await asyncio.sleep(1.0)
        finally:
            print(f"[AI] {self.display_name} stopped")