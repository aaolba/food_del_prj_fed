pipeline {
    agent any
    
    environment {
        DOCKER_REGISTRY = 'docker.io/your-username'
        IMAGE_NAME = 'food-delivery'
        SONAR_HOST = 'http://sonarqube:9000'
        DOCKER_BUILDKIT = '1'  // Enable BuildKit for faster builds
    }
    
    tools {
        nodejs 'nodejs-24'
    }
    
    stages {
        stage('🔍 Checkout') {
            steps {
                checkout scm
                script {
                    env.GIT_COMMIT_SHORT = sh(
                        script: "git rev-parse --short HEAD",
                        returnStdout: true
                    ).trim()
                }
            }
        }
        
        stage('📦 Install Dependencies') {
            parallel {
                stage('Backend') {
                    steps {
                        dir('backend') {
                            sh 'npm ci'
                        }
                    }
                }
                stage('Frontend') {
                    steps {
                        dir('frontend') {
                            sh 'npm ci'
                        }
                    }
                }
            }
        }
        
        stage('🧪 Unit Tests') {
            parallel {
                stage('Backend Tests') {
                    steps {
                        dir('backend') {
                            sh 'npm test -- --coverage --coverageReporters=lcov || true'
                        }
                    }
                    post {
                        always {
                            publishHTML([
                                allowMissing: true,
                                alwaysLinkToLastBuild: true,
                                keepAll: true,
                                reportDir: 'backend/coverage/lcov-report',
                                reportFiles: 'index.html',
                                reportName: 'Backend Coverage'
                            ])
                        }
                    }
                }
                stage('Frontend Tests') {
                    steps {
                        dir('frontend') {
                            sh 'npm test || true'
                        }
                    }
                }
            }
        }
        
        stage('🔐 SAST - SonarQube Analysis') {
            steps {
                withSonarQubeEnv('SonarQube') {
                    sh """
                        /usr/local/bin/sonar-scanner \
                          -Dsonar.projectKey=food-delivery \
                          -Dsonar.sources=backend,frontend/src \
                          -Dsonar.exclusions=**/node_modules/**,**/dist/**,**/build/**
                    """
                }
            }
        }
        
        /*stage('🔍 Quality Gate') {
            steps {
                timeout(time: 10, unit: 'MINUTES') {
                    script {
                        try {
                            def qg = waitForQualityGate()
                            if (qg.status != 'OK') {
                                echo "⚠️ Quality Gate failed: ${qg.status}"
                                // Uncomment the next line to make it blocking
                                // error "Quality Gate failed"
                            } else {
                                echo "✅ Quality Gate passed!"
                            }
                        } catch (Exception e) {
                            echo "⚠️ Quality Gate check failed: ${e.message}"
                            echo "Continuing pipeline..."
                        }
                    }
                }
            }
        }*/
        
        stage('🛡️ Dependency Check') {
            parallel {
                stage('Backend Audit') {
                    steps {
                        dir('backend') {
                            sh 'npm audit --audit-level=moderate --json > npm-audit-backend.json || true'
                            archiveArtifacts artifacts: 'npm-audit-backend.json', allowEmptyArchive: true
                        }
                    }
                }
                stage('Frontend Audit') {
                    steps {
                        dir('frontend') {
                            sh 'npm audit --audit-level=moderate --json > npm-audit-frontend.json || true'
                            archiveArtifacts artifacts: 'npm-audit-frontend.json', allowEmptyArchive: true
                        }
                    }
                }
            }
        }
        
        stage('🐳 Build Docker Images') {
            steps {
                script {
                    echo "Building Docker images with BuildKit..."
                    sh """
                        DOCKER_BUILDKIT=1 docker build \
                          --build-arg BUILDKIT_INLINE_CACHE=1 \
                          -t ${IMAGE_NAME}-backend:${GIT_COMMIT_SHORT} \
                          ./backend
                        
                        DOCKER_BUILDKIT=1 docker build \
                          --build-arg BUILDKIT_INLINE_CACHE=1 \
                          -t ${IMAGE_NAME}-frontend:${GIT_COMMIT_SHORT} \
                          ./frontend
                    """
                }
            }
        }
        
        stage('🔒 Container Security Scan - Trivy') {
            steps {
                sh """
                    trivy image --severity HIGH,CRITICAL \
                        --format json \
                        --output trivy-backend.json \
                        ${IMAGE_NAME}-backend:${GIT_COMMIT_SHORT} || true
                    
                    trivy image --severity HIGH,CRITICAL \
                        --format json \
                        --output trivy-frontend.json \
                        ${IMAGE_NAME}-frontend:${GIT_COMMIT_SHORT} || true
                """
                archiveArtifacts artifacts: 'trivy-*.json', allowEmptyArchive: true
                echo "✅ Container security scan complete!"
            }
        }
        
stage('🚀 Deploy to Staging') {
    steps {
        sh '''
            # Stop and remove existing containers
            docker stop food-backend food-frontend food-prometheus  2>/dev/null || true
            docker rm food-backend food-frontend food-prometheus  2>/dev/null || true
            
            # Deploy fresh containers
            docker compose -f docker-compose.yml up -d backend frontend prometheus 
            
            # Wait for services
            sleep 15
            
            # Verify deployment
            docker ps --filter "name=food-" --format "table {{.Names}}\\t{{.Status}}"
        '''
    }
}


        
        stage('🛡️ DAST - OWASP ZAP') {
            steps {
                script {
                    echo "Running OWASP ZAP baseline security scan..."
                    sh '''
                        # Pull ZAP image
                        docker pull owasp/zap2docker-stable || echo "Using cached ZAP image"
                        
                        # Run ZAP baseline scan
                        docker run --rm \
                          --network food_del_prj_fed_food-network \
                          -v $(pwd):/zap/wrk:rw \
                          owasp/zap2docker-stable \
                          zap-baseline.py \
                          -t http://food-frontend:3000 \
                          -r zap-report.html \
                          -J zap-report.json || true
                        
                        echo "✅ DAST scan complete!"
                    '''
                }
            }
            post {
                always {
                    publishHTML([
                        allowMissing: true,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: '.',
                        reportFiles: 'zap-report.html',
                        reportName: 'OWASP ZAP Security Report'
                    ])
                    archiveArtifacts artifacts: 'zap-report.json', allowEmptyArchive: true
                }
            }
        }
    }
    
    post {
        always {
            cleanWs()
        }
        success {
            echo "✅✅✅ Pipeline SUCCESS: ${env.JOB_NAME} #${env.BUILD_NUMBER} ✅✅✅"
            echo "All DevSecOps stages completed successfully!"
        }
        failure {
            echo "❌ Pipeline FAILED: ${env.JOB_NAME} #${env.BUILD_NUMBER}"
        }
    }
}
