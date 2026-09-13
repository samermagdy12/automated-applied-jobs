export const candidateProfile = {
  source: 'data/Samer_CV.pdf',
  skills: ['Python','C/C++','Java','TensorFlow','PyTorch','Keras','Scikit-learn','XGBoost','OpenCV','MediaPipe','YOLO','Large Language Models','Prompt Engineering','AI Agents','Function Calling','RAG','spaCy','Pandas','NumPy','Matplotlib','Plotly','Flask','Django','Streamlit','MongoDB','PostgreSQL','Git'],
  experience: [
    'AI & Automation Intern at Exology: LLMs, AI Agents, RAG, MCP, tool integration, structured workflows, intelligent automation.',
    'Computer Vision Intern at Cellula: ML/CV models, image segmentation, TensorFlow, PyTorch, OpenCV, healthcare and flood mapping.',
    'AI & Data Science Trainee at DEPI: Python, machine learning, deep learning, NLP, computer vision, YOLO vehicle detection, Scikit-learn and XGBoost.',
    'Machine Learning Engineer Intern at Cellula: classification/regression models, Flask, Django, MLOps and REST APIs.'
  ],
  projects: [
    'AI-Powered Claims Automation Platform using LLMs, RAG and agentic workflows.',
    'EyeDrive graduation project: CNN and SVM for real-time eye-state detection and assistive control.',
    'AI Data Analytics Assistant using LLMs and function calling.',
    'Real-Time Hand Gesture Recognition using MediaPipe, XGBoost and PyTorch.',
    'Arabic Sign Language Detection using CNN, MobileNetV2 and OpenCV.',
    'Real-Time Vehicle Detection using YOLO and OpenCV.',
    'Face Recognition using FaceNet, PCA, Random Forest and KNN.'
  ],
  education: ['Bachelor of Science in Computer Science, Canadian International College (CIC), GPA 3.22/4.0.'],
  certifications: ['Machine Learning Track, DataCamp (2025)', 'Deep Learning with PyTorch', 'NLP with spaCy', 'Model Validation and Hyperparameter Tuning']
}
export function profileChunks(profile = candidateProfile) { return [...profile.experience, ...profile.projects, ...profile.education, ...profile.certifications].map((text, i) => ({ id: i, text })) }
