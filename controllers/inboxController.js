// Model
const Conversation = require('../models/Converstion') ;
const People = require('../models/People') ;
const Message = require('../models/Message') ;


// Inbox page 
const getInbox = async (req, res) => {
    try {
        const authenticated_userid = req.user._id ; 
        const all_conversations = await Conversation.find({$or: [{creator:authenticated_userid }, {participant: authenticated_userid}]}, 'participant last_updated')
        .populate({
            path: 'participant',
            select: ['name', 'avatar'] 
        })
        .populate({
            path: 'creator',
            select: ['name', 'avatar'] 
        })
        .sort({ last_updated: -1 });
        const conversationsWithLastMessage = await Promise.all(all_conversations.map(async (conversation) => {
            const lastMessage = await Message.findOne({ conversation_id: conversation._id })
              .sort({ date_time: -1 }) 
              .select('text date_time')
              .lean();
              
            return {
                ...conversation,
                lastmessage : lastMessage || null 
            }
        }));
            
        res.render('inbox', {
            all_conversation : conversationsWithLastMessage
        });

    } catch (error) {
        console.log(error) ;
        res.status(500).send('Internal Server Error');
    }
}

// create conversation
const crerateConversation = async (req, res) => {
    try {
        const { id } = req.body;
        const haveConversation = await Conversation.findOne({
            $or: [
                { creator: req.user._id, participant: id },
                { creator: id, participant: req.user._id }
            ]
        });     
        if (haveConversation) {
            return res.status(400).json({
                errors: {
                  common: {
                    msg: "Already have conversation.",
                  },
                },
            });
        }   
        const creat_conversation = new Conversation({
            creator: req.user._id,
            participant:  id 
        
        })

        await creat_conversation.save();

        res.status(200).json({
            message: "Conversation was added successfully!",
        });
      
        
    } catch (error) {
        console.log(error);
        res.status(500).json({
            errors: {
              common: {
                msg: err.message,
              },
            },
        });
    }
}

// Get message of the selected conversation 
const getMessage = async (req, res) => {
    try {
        const { conversation_id } = req.body;

        // Find messages with the specified conversation_id
        const get_conversation_message = await Message.find({ conversation_id });

        console.log("get_conversation_message", get_conversation_message);
        res.json(get_conversation_message);
    } catch (error) {
        console.error("Error fetching conversation messages:", error);
        res.status(500).send("An error occurred while fetching the messages");
    }
};



// Submit message
const submitMessage = async (req, res) => {
    try {
        const { conversation_id, attachments, message } = req.body;
        const loggedin_userid = req.user._id;
        const loggedin_username = req.user.name;

        const conversation = await Conversation.findById(conversation_id)
            .populate('creator', 'name')
            .populate('participant', 'name')
            .exec();

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        const { creator: { name: creator_name, _id : creator_id }, participant: { name: participant_name, _id: participant_id } } = conversation;

        let receiverId, receiverName;
        if (loggedin_userid === creator_id.toString()) {
            receiverId = participant_id.toString();
            receiverName = participant_name;
        } else {
            receiverId = creator_id.toString();;
            receiverName = creator_name;
        }

        const newMessage = new Message({
            text: message,
            attachment: attachments ? attachments.map(file => file.fileName) : [],
            sender: {
                id: loggedin_userid,
                name: loggedin_username,
            },
            receiver: {
                id: receiverId,
                name: receiverName,
            },
            conversation_id: conversation_id
        });

        await newMessage.save();
        res.status(201).json(newMessage);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send message' });
    }
};

module.exports = {
    getInbox,
    crerateConversation,
    getMessage,
    submitMessage
}