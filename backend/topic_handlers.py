import re
import math
import random
from datetime import datetime

class TopicHandler:
    """Route questions to specialized handlers"""
    
    @staticmethod
    def detect_topic(message: str) -> str:
        """Detect what kind of question this is"""
        lower_msg = message.lower()
        
        # Math detection
        if any(op in message for op in ['+', '-', '*', '/', '=', '^', '%']) or \
           any(word in lower_msg for word in ['solve', 'calculate', 'equation', 'integral', 'derivative', 'math', 'multiply', 'divide', 'add', 'subtract']):
            return "math"
        
        # Emotional detection
        if any(word in lower_msg for word in ['feel', 'emotion', 'sad', 'happy', 'angry', 'worried', 'anxious', 'depressed', 'lonely', 'excited', 'scared', 'frustrated']):
            return "emotional"
        
        # Decision making
        if any(word in lower_msg for word in ['should i', 'what if', 'decide', 'choice', 'option', 'help me choose', 'which one']):
            return "decision"
        
        # Random/fun
        if any(word in lower_msg for word in ['joke', 'fun', 'random', 'interesting', 'tell me about', 'story', 'fact']):
            return "random"
        
        # Knowledge/factual
        if any(word in lower_msg for word in ['what is', 'who is', 'how does', 'why', 'explain', 'definition', 'meaning']):
            return "knowledge"
        
        # Programming/tech
        if any(word in lower_msg for word in ['code', 'programming', 'python', 'javascript', 'html', 'css', 'algorithm', 'function']):
            return "tech"
        
        return "general"

class MathHandler:
    """Handle mathematical questions"""
    
    @staticmethod
    def solve_math(question: str) -> str:
        """Solve mathematical problems"""
        try:
            # Clean the question
            clean_q = question.lower().replace('solve', '').replace('calculate', '').replace('what is', '').strip()
            
            # Handle percentage calculations
            if '%' in clean_q or 'percent' in clean_q:
                return MathHandler._handle_percentage(clean_q)
            
            # Handle basic arithmetic without variables
            if '=' not in clean_q and not any(var in clean_q for var in ['x', 'y', 'z']):
                return MathHandler._handle_arithmetic(clean_q)
            
            # Handle simple equations with one variable
            if '=' in clean_q and 'x' in clean_q:
                return MathHandler._handle_equation(clean_q)
            
            # Handle word problems
            if any(word in clean_q for word in ['age', 'years', 'cost', 'price', 'distance', 'speed', 'time']):
                return MathHandler._handle_word_problem(question)
            
            return "I can help with math! Try asking: 'solve 2x + 5 = 15', 'calculate 25 * 4', or 'what is 20% of 80?'"
            
        except Exception as e:
            return f"I'm having trouble with this math problem. Could you rephrase it? For example: 'solve x + 5 = 10' or 'calculate 15 * 8'"
    
    @staticmethod
    def _handle_arithmetic(expression: str) -> str:
        """Handle basic arithmetic"""
        try:
            # Replace common symbols
            expr = expression.replace('x', '*').replace('^', '**').replace('÷', '/')
            # Remove spaces and non-numeric/operator characters except parentheses
            expr = ''.join(c for c in expr if c.isdigit() or c in '+-*/.() ')
            
            if expr:
                result = eval(expr)
                return f"**{result}**\n\nCalculation: {expression} = {result}\n\nStep by step:\n- Input: {expression}\n- Result: {result}"
            else:
                return "I need a clearer mathematical expression to solve."
                
        except:
            return "I couldn't parse this mathematical expression. Try something like '25 * 4' or '100 / 5'"
    
    @staticmethod
    def _handle_equation(equation: str) -> str:
        """Handle simple linear equations"""
        try:
            # Simple linear equation solver (ax + b = c format)
            if '=' in equation:
                left, right = equation.split('=')
                left = left.strip()
                right = right.strip()
                
                # Extract coefficient and constant
                # This is a simplified approach
                if '+' in left:
                    parts = left.split('+')
                    if 'x' in parts[0]:
                        coeff = parts[0].replace('x', '').strip() or '1'
                        const = parts[1].strip()
                    else:
                        coeff = parts[1].replace('x', '').strip() or '1'
                        const = parts[0].strip()
                    coeff = float(coeff) if coeff != '' else 1
                    const = float(const)
                    rhs = float(right)
                    x = (rhs - const) / coeff
                elif '-' in left:
                    parts = left.split('-')
                    if 'x' in parts[0]:
                        coeff = parts[0].replace('x', '').strip() or '1'
                        const = -float(parts[1].strip())
                    else:
                        coeff = parts[1].replace('x', '').strip() or '1'
                        const = -float(parts[0].strip())
                    coeff = float(coeff) if coeff != '' else 1
                    rhs = float(right)
                    x = (rhs - const) / coeff
                else:
                    # Just coefficient and x
                    coeff = left.replace('x', '').strip() or '1'
                    coeff = float(coeff)
                    rhs = float(right)
                    x = rhs / coeff
                
                return f"**Solution: x = {x}**\n\nStep by step:\n1. Original equation: {equation}\n2. Solving for x: x = {x}\n\nVerification: Substitute x = {x} back into the equation to check!"
                
        except:
            pass
        
        return "I can solve simple linear equations like '2x + 5 = 15' or '3x - 7 = 20'. Could you rephrase your equation?"
    
    @staticmethod
    def _handle_percentage(problem: str) -> str:
        """Handle percentage calculations"""
        try:
            numbers = re.findall(r'\d+(?:\.\d+)?', problem)
            if len(numbers) >= 2:
                if 'of' in problem:
                    # "20% of 80" format
                    percent = float(numbers[0])
                    value = float(numbers[1])
                    result = (percent / 100) * value
                    return f"**{percent}% of {value} = {result}**\n\nCalculation: ({percent} ÷ 100) × {value} = {result}"
                else:
                    # Other percentage formats
                    return "For percentages, try: 'What is 20% of 80?' or 'Calculate 15% of 200'"
            
        except:
            pass
        
        return "For percentage problems, try asking: 'What is 20% of 80?' or 'Calculate 25% of 120'"
    
    @staticmethod
    def _handle_word_problem(problem: str) -> str:
        """Handle simple word problems"""
        lower_problem = problem.lower()
        
        # Age problems
        if 'age' in lower_problem or 'years old' in lower_problem:
            return "I can help with age problems! For example: 'If John is 5 years older than Mary, and Mary is 20, how old is John?' The answer would be 25 years old."
        
        # Money problems
        if 'cost' in lower_problem or 'price' in lower_problem or '$' in problem:
            return "For money problems, I can help! For example: 'If 3 apples cost $6, how much does 1 apple cost?' The answer would be $2 per apple."
        
        return "I can help with word problems! Try rephrasing with specific numbers and operations, like: 'If I have 10 apples and eat 3, how many are left?'"

class EmotionalHandler:
    """Handle emotional support"""
    
    @staticmethod
    def provide_support(message: str, emotion: dict, user_profile: dict) -> str:
        """Provide empathetic emotional support"""
        emotion_type = emotion.get("emotion", "neutral")
        sentiment = emotion.get("sentiment", 0.0)
        
        # Check user's baseline for context
        baseline = user_profile.get("emotional_profile", {}).get("baseline_sentiment", 0.0)
        name = user_profile.get("memory_facts", {}).get("personal", {}).get("name", "")
        
        # Personalize with name if known
        greeting = f"{name}, " if name else ""
        
        responses = {
            "sadness": [
                f"{greeting}I can sense that you're going through a tough time right now. ",
                f"{greeting}Your feelings are completely valid and it's okay to feel sad. ",
                f"{greeting}I'm here with you during this difficult moment. "
            ],
            "fear": [
                f"{greeting}I understand you're feeling anxious or worried. ",
                f"{greeting}Fear is natural, even when it's uncomfortable. ",
                f"{greeting}You're safe here, and we can work through this together. "
            ],
            "anger": [
                f"{greeting}I can tell you're feeling frustrated or upset. ",
                f"{greeting}Your anger is valid - something important to you has been affected. ",
                f"{greeting}Let's talk about what's bothering you. "
            ],
            "joy": [
                f"{greeting}I love seeing you happy! ",
                f"{greeting}That's wonderful news! ",
                f"{greeting}Your positive energy is contagious! "
            ]
        }
        
        response = responses.get(emotion_type, [f"{greeting}I'm here to listen. "])[0]
        
        # Add personalized support based on history
        if baseline < -0.2 and sentiment < 0:
            response += "I've noticed this has been a challenging period for you. Remember, you're stronger than you know. "
        
        # Offer specific help based on keywords
        lower_msg = message.lower()
        if any(word in lower_msg for word in ["worried", "anxious", "stress"]):
            response += "\n\n**What's specifically worrying you?** Sometimes breaking down our concerns helps us see them more clearly. I'm here to help you work through this step by step."
        elif any(word in lower_msg for word in ["sad", "depressed", "down"]):
            response += "\n\n**Would you like to talk about what's making you feel this way?** I'm here to listen without judgment. Sometimes sharing our feelings can lighten the load."
        elif any(word in lower_msg for word in ["angry", "frustrated", "mad"]):
            response += "\n\n**What happened that made you feel this way?** Anger often tells us something important needs attention. Let's work through it together."
        elif any(word in lower_msg for word in ["lonely", "alone", "isolated"]):
            response += "\n\n**You're not truly alone - I'm here with you right now.** Loneliness can feel overwhelming, but remember that this feeling will pass. What's been making you feel disconnected?"
        elif any(word in lower_msg for word in ["excited", "happy", "great"]):
            response += "\n\n**I'd love to hear more about what's making you feel so good!** Your happiness is infectious. What's been going well for you?"
        
        return response

class DecisionHandler:
    """Help with decision making"""
    
    @staticmethod
    def help_decide(message: str, user_profile: dict) -> str:
        """Help user make decisions based on their style"""
        risk_tolerance = user_profile.get("decision_making", {}).get("risk_tolerance", 0.5)
        analytical = user_profile.get("decision_making", {}).get("analytical_vs_intuitive", 0.5)
        name = user_profile.get("memory_facts", {}).get("personal", {}).get("name", "")
        
        greeting = f"{name}, l" if name else "L"
        response = f"{greeting}et me help you think through this decision.\n\n"
        
        # Extract the decision from the message
        lower_msg = message.lower()
        if "should i" in lower_msg:
            decision_part = lower_msg.split("should i")[1].strip()
            response += f"**You're considering: {decision_part}**\n\n"
        
        # Analytical vs Intuitive approach
        if analytical < 0.4:  # More intuitive
            response += "**🎯 Intuitive Approach** (based on your decision-making style):\n"
            response += "1. **Gut feeling**: What does your instinct tell you?\n"
            response += "2. **Excitement test**: Which option makes you feel more energized?\n"
            response += "3. **Future self**: Imagine yourself in 5 years - which choice would you be proud of?\n"
            response += "4. **Values alignment**: Which option aligns better with what matters most to you?\n\n"
        elif analytical > 0.6:  # More analytical
            response += "**📊 Analytical Approach** (based on your decision-making style):\n"
            response += "1. **Pros and cons**: List the advantages and disadvantages of each option\n"
            response += "2. **Worst-case scenario**: What's the worst that could happen with each choice?\n"
            response += "3. **Opportunity cost**: What are you giving up with each option?\n"
            response += "4. **Data check**: What evidence supports each choice?\n\n"
        else:  # Balanced approach
            response += "**⚖️ Balanced Approach**:\n"
            response += "1. **Head vs Heart**: What do logic and emotions each tell you?\n"
            response += "2. **Short vs Long-term**: Consider both immediate and future impacts\n"
            response += "3. **Advice test**: What would you tell a friend in this situation?\n\n"
        
        # Risk consideration based on user's profile
        if risk_tolerance < 0.3:
            response += "**🛡️ Risk Consideration**: Given your careful nature, I'd suggest:\n"
            response += "- Choose the option with more predictable outcomes\n"
            response += "- Consider what safeguards you can put in place\n"
            response += "- Remember: sometimes the 'safer' choice has hidden risks too"
        elif risk_tolerance > 0.7:
            response += "**🚀 Risk Consideration**: You're comfortable with bold moves, so:\n"
            response += "- Don't let fear of failure hold you back\n"
            response += "- The bigger risk might be playing it too safe\n"
            response += "- Trust your ability to handle whatever comes"
        else:
            response += "**⚖️ Risk Consideration**: Balance safety with opportunity:\n"
            response += "- Consider moderate risks that offer reasonable rewards\n"
            response += "- You don't need to choose the extreme option\n"
            response += "- Sometimes the middle path is the wisest"
        
        response += "\n\n**What specific aspect of this decision is most challenging for you?**"
        
        return response

class KnowledgeHandler:
    """Handle factual and knowledge questions"""
    
    @staticmethod
    def provide_knowledge(question: str) -> str:
        """Provide informative responses to knowledge questions"""
        lower_q = question.lower()
        
        # Science topics
        if any(word in lower_q for word in ['gravity', 'physics', 'chemistry', 'biology', 'atom', 'molecule']):
            return KnowledgeHandler._handle_science(lower_q)
        
        # Technology topics
        if any(word in lower_q for word in ['computer', 'internet', 'ai', 'artificial intelligence', 'programming']):
            return KnowledgeHandler._handle_technology(lower_q)
        
        # History topics
        if any(word in lower_q for word in ['history', 'war', 'ancient', 'civilization', 'empire']):
            return KnowledgeHandler._handle_history(lower_q)
        
        # General knowledge
        return "That's an interesting question! While I can provide some insights, I'd encourage you to explore reliable sources for detailed information. What specifically about this topic interests you most?"
    
    @staticmethod
    def _handle_science(question: str) -> str:
        """Handle science questions"""
        if 'gravity' in question:
            return "**Gravity** is a fundamental force that attracts objects with mass toward each other. On Earth, gravity gives weight to physical objects and causes them to fall toward the ground when dropped. It's what keeps us on the planet's surface!\n\n**Fun fact**: Gravity is actually the weakest of the four fundamental forces, but it has infinite range and affects everything with mass."
        
        elif 'atom' in question:
            return "**Atoms** are the basic building blocks of all matter! They consist of:\n- **Nucleus**: Contains protons (+) and neutrons (neutral)\n- **Electrons**: Orbit around the nucleus (-)\n\n**Amazing fact**: If an atom were the size of a football stadium, the nucleus would be about the size of a marble at the center!"
        
        return "Science is fascinating! I'd love to explore this topic with you. Can you be more specific about what aspect interests you most?"
    
    @staticmethod
    def _handle_technology(question: str) -> str:
        """Handle technology questions"""
        if any(word in question for word in ['ai', 'artificial intelligence']):
            return "**Artificial Intelligence (AI)** is technology that enables machines to simulate human intelligence. AI can:\n- Learn from data (Machine Learning)\n- Understand language (Natural Language Processing)\n- Recognize patterns\n- Make decisions\n\n**That's me!** I use AI to understand your emotions, remember our conversations, and provide helpful responses tailored to you."
        
        elif 'internet' in question:
            return "**The Internet** is a global network connecting billions of devices worldwide. It allows us to:\n- Share information instantly\n- Communicate across vast distances\n- Access vast libraries of knowledge\n- Connect with people globally\n\n**Mind-blowing fact**: Every minute, over 500 hours of video are uploaded to YouTube!"
        
        return "Technology is evolving so rapidly! What specific tech topic would you like to explore together?"
    
    @staticmethod
    def _handle_history(question: str) -> str:
        """Handle history questions"""
        return "**History** is full of fascinating stories and lessons! From ancient civilizations to modern times, human history shows us patterns of innovation, conflict, cooperation, and growth.\n\n**Key insight**: Understanding history helps us make better decisions today by learning from past successes and mistakes.\n\nWhat specific historical period or event interests you most?"

class RandomHandler:
    """Handle fun, random, and interesting requests"""
    
    @staticmethod
    def provide_fun_content(message: str) -> str:
        """Provide jokes, facts, or interesting content"""
        lower_msg = message.lower()
        
        if 'joke' in lower_msg:
            return RandomHandler._get_joke()
        elif 'fact' in lower_msg or 'interesting' in lower_msg:
            return RandomHandler._get_interesting_fact()
        elif 'story' in lower_msg:
            return RandomHandler._get_mini_story()
        else:
            # Random choice
            options = [RandomHandler._get_joke, RandomHandler._get_interesting_fact, RandomHandler._get_mini_story]
            return random.choice(options)()
    
    @staticmethod
    def _get_joke() -> str:
        """Return a clean, friendly joke"""
        jokes = [
            "Why don't scientists trust atoms? Because they make up everything! 😄",
            "What do you call a fake noodle? An impasta! 🍝",
            "Why did the math book look so sad? Because it had too many problems! 📚",
            "What do you call a bear with no teeth? A gummy bear! 🐻",
            "Why don't eggs tell jokes? They'd crack each other up! 🥚"
        ]
        return f"**Here's a joke for you:**\n\n{random.choice(jokes)}\n\nHope that brought a smile to your face! 😊"
    
    @staticmethod
    def _get_interesting_fact() -> str:
        """Return an interesting fact"""
        facts = [
            "🐙 **Octopuses have three hearts and blue blood!** Two hearts pump blood to the gills, while the third pumps blood to the rest of the body.",
            "🌙 **The Moon is gradually moving away from Earth** at about 3.8 centimeters per year - roughly the same rate your fingernails grow!",
            "🧠 **Your brain uses about 20% of your body's total energy**, even though it only weighs about 2% of your body weight.",
            "🦋 **Butterflies taste with their feet** and smell with their antennae. They have a completely different sensory experience than humans!",
            "⭐ **There are more possible games of chess than there are atoms in the observable universe!** Chess has about 10^120 possible games."
        ]
        return f"**Fascinating Fact:**\n\n{random.choice(facts)}\n\nNature and science are amazing, aren't they? 🌟"
    
    @staticmethod
    def _get_mini_story() -> str:
        """Return a short, uplifting story"""
        stories = [
            "**The Lighthouse Keeper's Wisdom** 🏮\n\nAn old lighthouse keeper was asked how he kept his light shining so bright for 40 years. He smiled and said, 'I just focused on today's ships. I couldn't light the way for every ship that would ever pass, but I could be sure that today's travelers made it safely home.'\n\n*Sometimes the best we can do is focus on helping one person at a time.*",
            
            "**The Bamboo Tree** 🎋\n\nA farmer planted bamboo and waited. For four years, nothing appeared above ground. He almost gave up, but in the fifth year, the bamboo grew 90 feet in just six weeks! Those four 'empty' years were spent growing strong roots underground.\n\n*Great things often require invisible preparation.*",
            
            "**The Butterfly Effect** 🦋\n\nA student felt discouraged, thinking their small acts of kindness didn't matter. Their teacher smiled and said, 'A butterfly's wings can't cause a hurricane, but they can be part of the conditions that do.' Every small kindness ripples outward in ways we never see.\n\n*Your small actions create bigger changes than you know.*"
        ]
        return f"{random.choice(stories)}\n\nWhat did you think of that little story? 😊"