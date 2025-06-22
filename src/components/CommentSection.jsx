import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import {
  collection,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';

const CommentSection = ({ roomId, taskId }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    const commentsRef = collection(db, 'rooms', roomId, 'tasks', taskId, 'comments');
    const q = query(commentsRef, orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setComments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [roomId, taskId]);

  const handleSend = async () => {
    if (!newComment.trim()) return;
    const commentsRef = collection(db, 'rooms', roomId, 'tasks', taskId, 'comments');
    await addDoc(commentsRef, {
      text: newComment,
      user: auth.currentUser.email,
      timestamp: serverTimestamp()
    });
    setNewComment('');
  };

  return (
    <div className="mt-3 bg-gray-50 border rounded p-3">
      <h4 className="font-semibold mb-2">💬 Comments</h4>
      <div className="max-h-40 overflow-y-auto mb-3 space-y-2">
        {comments.map((comment) => (
          <div key={comment.id} className="text-sm bg-white p-2 border rounded">
            <p><span className="font-semibold">{comment.user}</span>: {comment.text}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Type your message"
          className="flex-1 border px-2 py-1 rounded"
        />
        <button onClick={handleSend} className="bg-blue-500 text-white px-3 rounded">
          Send
        </button>
      </div>
    </div>
  );
};

export default CommentSection;
