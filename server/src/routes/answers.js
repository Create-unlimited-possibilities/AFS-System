import express from 'express';
import answerController from '../controllers/AnswerController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.get('/questions', protect, (req, res) => {
  answerController.getQuestions(req, res);
});
router.post('/answer/self', protect, (req, res) => {
  answerController.saveSelfAnswer(req, res);
});
router.post('/answer/assist', protect, (req, res) => {
  answerController.saveAssistAnswer(req, res);
});
router.get('/progress/self', protect, (req, res) => {
  answerController.getSelfProgress(req, res);
});
router.get('/answers/self', protect, (req, res) => {
  answerController.getSelfAnswers(req, res);
});
router.get('/answers/from-others', protect, (req, res) => {
  answerController.getAnswersFromOthers(req, res);
});
router.get('/answers/contributor/:contributorId', protect, (req, res) => {
  answerController.getContributorAnswers(req, res);
});
router.post('/answers/batch-self', protect, (req, res) => {
  answerController.batchSaveSelfAnswers(req, res);
});
router.post('/answers/batch-assist', protect, (req, res) => {
  answerController.batchSaveAssistAnswers(req, res);
});

export default router;
